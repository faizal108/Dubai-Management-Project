import React, { useState, useMemo } from "react";
import {
  Input,
  Button,
  IconButton,
  Typography,
  Checkbox,
} from "@material-tailwind/react";
import { PencilIcon, TrashIcon, PrinterIcon, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export default function CommonTable({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  onPrint,
}) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [colFilters, setColFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);

  // Filtering logic
  const filteredData = useMemo(() => {
    let temp = data;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      temp = temp.filter((row) =>
        columns.some((col) =>
          String(row[col.key] ?? "")
            .toLowerCase()
            .includes(term)
        )
      );
    }
    Object.entries(colFilters).forEach(([key, val]) => {
      if (val) {
        temp = temp.filter((row) =>
          String(row[key] ?? "")
            .toLowerCase()
            .includes(val.toLowerCase())
        );
      }
    });
    return temp;
  }, [data, globalSearch, colFilters, columns]);

  // Pagination
  const totalRecords = filteredData.length;
  const totalPages = Math.max(Math.ceil(totalRecords / pageSize), 1);
  const currentData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData
      .slice(start, start + pageSize)
      .map((row, idx) => ({ ...row, __idx: start + idx }));
  }, [filteredData, page, pageSize]);

  // Selection logic
  const isAllSelected =
    currentData.length > 0 &&
    currentData.every((row) => selected.includes(row.__idx));
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected((prev) =>
        Array.from(new Set([...prev, ...currentData.map((row) => row.__idx)]))
      );
    } else {
      setSelected((prev) =>
        prev.filter((idx) => !currentData.map((row) => row.__idx).includes(idx))
      );
    }
  };
  const handleSelectRow = (idx) => (e) => {
    if (e.target.checked) setSelected((prev) => [...prev, idx]);
    else setSelected((prev) => prev.filter((i) => i !== idx));
  };

  const handleFilterChange = (colKey, val) => {
    setColFilters((prev) => ({ ...prev, [colKey]: val }));
    setPage(1);
  };
  const prevPage = () => setPage((p) => Math.max(p - 1, 1));
  const nextPage = () => setPage((p) => Math.min(p + 1, totalPages));

  const exportToExcel = () => {
    // build an array of objects matching your visible columns
    const exportData = filteredData.map((row) =>
      columns.reduce((acc, col) => {
        acc[col.label] = row[col.key];
        return acc;
      }, {})
    );

    // create a new workbook & worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donors");

    // trigger download
    XLSX.writeFile(wb, "donors_export.xlsx");
  };
  return (
    <div className="w-full p-6 bg-white shadow-md rounded-lg">
      {/* Global Search & Page Size */}
      <div className="flex justify-between items-center gap-2 mb-4">
        {/* <Input
          placeholder="Search..."
          value={globalSearch}
          onChange={(e) => {
            setGlobalSearch(e.target.value);
            setPage(1);
          }}
          className="w-full"
        /> */}
        <Input
            type="text"
            placeholder="Search ..."
            value={globalSearch}
            className="w-full"
            onChange={(e) => {
                setGlobalSearch(e.target.value);
                setPage(1);
              }}
            label="Search"
          />
        <div className="flex items-center space-x-2">
          <IconButton
            size="sm"
            variant="text"
            color="blue"
            onClick={exportToExcel}
            title="Export to Excel"
          >
            <FileSpreadsheet size={25} />
          </IconButton>
          <Typography variant="small">Show</Typography>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(+e.target.value);
              setPage(1);
            }}
            className="border rounded p-1"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <Typography variant="small">entries</Typography>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr>
              <th className="px-4 py-2">
                <Checkbox
                  size="small"
                  checked={isAllSelected}
                  // only apply indeterminate when partial selection
                  indeterminate={
                    selected.length > 0 && !isAllSelected ? true : undefined
                  }
                  onChange={handleSelectAll}
                />
              </th>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2 text-left w-auto">
                  <div className="flex flex-col">
                    <span>{col.label}</span>
                    <Input
                      placeholder={`Search ${col.label}`}
                      value={colFilters[col.key] || ""}
                      onChange={(e) =>
                        handleFilterChange(col.key, e.target.value)
                      }
                    />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? (
              currentData.map((row) => (
                <tr key={row.__idx} className="border-t">
                  <td className="px-4 py-2">
                    <Checkbox
                      size="small"
                      checked={selected.includes(row.__idx)}
                      onChange={handleSelectRow(row.__idx)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2">
                      {row[col.key]}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <div className="flex space-x-2">
                      <IconButton
                        size="sm"
                        variant="text"
                        onClick={() => onEdit(row, row.__idx)}
                      >
                        <PencilIcon size={16} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="text"
                        onClick={() => onDelete(row.__idx)}
                      >
                        <TrashIcon size={16} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="text"
                        onClick={() => onPrint(row)}
                      >
                        <PrinterIcon size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-4">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <Typography variant="small">
          Showing {(page - 1) * pageSize + 1}-
          {Math.min(page * pageSize, totalRecords)} of {totalRecords} records |
          Page {page} of {totalPages}
        </Typography>
        <div className="space-x-2">
          <Button
            size="sm"
            variant="outlined"
            disabled={page === 1}
            onClick={prevPage}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outlined"
            disabled={page === totalPages}
            onClick={nextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
