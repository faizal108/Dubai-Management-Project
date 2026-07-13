export function convertNumberToWords(num) {
  if (typeof num !== "number" || !isFinite(num) || !Number.isInteger(num)) {
    throw new TypeError("Input must be a finite integer");
  }
  if (Math.abs(num) > 999_999_999) {
    throw new RangeError("Absolute value must be <= 999,999,999");
  }
  if (num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  // Helper to convert 1–99
  function twoDigitsToWords(n) {
    if (n < 20) return ones[n];
    const tenUnit = Math.floor(n / 10);
    const rem = n % 10;
    return rem === 0 ? tens[tenUnit] : `${tens[tenUnit]} ${ones[rem]}`;
  }

  // Helper to convert 1–999
  function threeDigitsToWords(n) {
    const hundredUnit = Math.floor(n / 100);
    const rem = n % 100;
    let str = "";
    if (hundredUnit) {
      str += `${ones[hundredUnit]} Hundred`;
      if (rem) str += " ";
    }
    if (rem) {
      str += twoDigitsToWords(rem);
    }
    return str;
  }

  // Break number into Indian groups: [crores, lakhs, thousands, hundreds+]
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num; // 0–999

  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (remainder) parts.push(threeDigitsToWords(remainder));

  const result = parts.join(" ").trim();
  return num < 0 ? `Minus ${result}` : result;
}
