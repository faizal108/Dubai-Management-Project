import { useNavigate } from "react-router-dom";
import { NoSymbolIcon } from "@heroicons/react/24/outline";
import { Button, Card, CardBody } from "../../../components/ui";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <NoSymbolIcon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Access Denied
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You don’t have permission to view this page.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              If you believe this is a mistake, please contact your administrator.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
