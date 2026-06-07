// src/components/Export/ExportReportModal.tsx
import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
  Card,
  CardBody,
} from "@heroui/react";
import { FiDownload, FiPrinter, FiFileText, FiFile } from "react-icons/fi";
import { TbFileSpreadsheet } from "react-icons/tb";
import * as XLSX from "xlsx";

import { useEditorStore } from "@/store/useEditorStore";
import { getReportFooterHTML } from "@/utils/exportFooter";

interface ExportReportModalProps {
  editorId: string;
  open: boolean;
  projectName?: string;
  onClose: () => void;
}

interface ReportItem {
  slNo: number;
  tagNo: string;
  type: string;
  description: string;
  originalItem: any;
}

type ExportFormat = "csv" | "excel" | "pdf" | "print";

interface FormatOption {
  key: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  editorId,
  open,
  projectName,
  onClose,
}) => {
  const editorState = useEditorStore((s) => s.editors[editorId]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const createdBy = localStorage.getItem("username") || "Unknown User";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const footerHTML = getReportFooterHTML(projectName || "Untitled Project", createdBy, dateStr);

  // Transform editor items to report items
  const items = useMemo(() => {
    if (!editorState?.items) return [];

    return [...editorState.items]
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .map((item, index) => ({
        slNo: index + 1,
        tagNo: item.label || `TAG-${index + 1}`,
        type: item.object || item.name || "N/A",
        description: item.description || "No description",
        originalItem: item,
      })) as ReportItem[];
  }, [editorState]);

  // Format options
  const formatOptions: FormatOption[] = [
    {
      key: "csv",
      label: "CSV",
      description: "Spreadsheet format",
      icon: <FiFileText className="text-blue-600 dark:text-blue-400" />,
      color: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      key: "excel",
      label: "Excel",
      description: "Advanced formatting",
      icon: (
        <TbFileSpreadsheet className="text-green-600 dark:text-green-400" />
      ),
      color: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
    },
    {
      key: "pdf",
      label: "PDF",
      description: "Print ready",
      icon: <FiFile className="text-red-600 dark:text-red-400" />,
      color: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
    },
    {
      key: "print",
      label: "Print",
      description: "Direct print",
      icon: <FiPrinter className="text-purple-600 dark:text-purple-400" />,
      color: "bg-purple-50 dark:bg-purple-900/20",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
  ];

  // Function to export to CSV
  const exportToCSV = (items: ReportItem[]) => {
    if (items.length === 0) return;

    const headers = ["Sl No", "Tag No", "Type", "Description"];
    const csvContent = [
      headers.join(","),
      ...items.map(
        (item) =>
          `"${item.slNo}","${item.tagNo}","${item.type}","${item.description}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `equipment-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Function to export to Excel
  const exportToExcel = (items: ReportItem[]) => {
    if (items.length === 0) return;

    // Prepare worksheet data
    const worksheetData = [
      ["Equipment Report", "", "", ""],
      [`Generated on: ${new Date().toLocaleDateString()}`, "", "", ""],
      [], // Empty row
      ["Sl No", "Tag No", "Type", "Description"],
      ...items.map((item) => [
        item.slNo,
        item.tagNo,
        item.type,
        item.description,
      ]),
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    const colWidths = [
      { wch: 8 }, // Sl No
      { wch: 20 }, // Tag No
      { wch: 15 }, // Type
      { wch: 40 }, // Description
    ];

    ws["!cols"] = colWidths;

    // Add some styling through cell metadata
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:D1");

    // Style header row (row 4, 0-indexed)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });

      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo color
        alignment: { horizontal: "center" },
      };
    }

    // Style title row
    const titleCell = ws["A1"];

    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: "center" },
      };
      // Merge title cells
      ws["!merges"] = ws["!merges"] || [];
      ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    }

    // Style date row
    const dateCell = ws["A2"];

    if (dateCell) {
      dateCell.s = {
        font: { italic: true },
        alignment: { horizontal: "center" },
      };
      ws["!merges"] = ws["!merges"] || [];
      ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
    }

    // Add workbook to book
    XLSX.utils.book_append_sheet(wb, ws, "Equipment Report");

    // Generate and download file
    XLSX.writeFile(
      wb,
      `equipment-report-${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  // Handle Print/PDF with better print styling
  const handlePrint = () => {
    // Create a print-friendly version
    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .print-header { text-align: center; margin-bottom: 30px; }
            .print-header h1 { margin: 0; color: #333; }
            .print-header .date { color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #4F46E5; color: white; font-weight: 600; }
            th, td { border: 1px solid #d1d5db; padding: 12px 8px; text-align: left; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .footer { margin-top: 30px; text-align: right; color: #666; }
            .stats { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; }
            .stat-item { text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
            .stat-label { font-size: 12px; color: #666; }
            /* Title block table must not inherit outer table styles */
            .title-block table { margin-top: 0; border-collapse: collapse; }
            .title-block td { border: none !important; padding: 5px 0; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Equipment Report</h1>
            <div class="date">Generated on ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-value">${items.length}</div>
              <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${new Set(items.map((i) => i.type)).size}</div>
              <div class="stat-label">Unique Types</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${items.filter(
      (i) => i.description && i.description !== "No description",
    ).length
      }</div>
              <div class="stat-label">With Description</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Sl No</th>
                <th>Tag No</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${items
        .map(
          (item) => `
                <tr>
                  <td>${item.slNo}</td>
                  <td><strong>${item.tagNo}</strong></td>
                  <td>${item.type}</td>
                  <td>${item.description}</td>
                </tr>
              `,
        )
        .join("")}
            </tbody>
          </table>
          ${footerHTML}
          <div class="footer">
            Total Items: ${items.length}
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Report</button>
            <button onclick="window.close()" style="padding: 10px 20px; margin-left: 10px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
          </div>
          <script>
            window.onload = function() {
              // Auto-print if coming from print button
              if (window.location.search.includes('autoprint=true')) {
                window.print();
              }
            }
            window.onafterprint = function() {
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Handle PDF export (uses print dialog)
  const handlePDFExport = () => {
    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    // Similar to handlePrint but with PDF-specific instructions
    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment Report - PDF</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 20mm;
              }
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 11pt;
                line-height: 1.5;
              }
              .page-break {
                page-break-after: always;
              }
            }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #4F46E5; }
            .header h1 { margin: 0; color: #1f2937; font-size: 24pt; }
            .header .subtitle { color: #6b7280; margin-top: 5px; }
            .metadata { display: flex; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
            .meta-item { text-align: center; }
            .meta-value { font-size: 18pt; font-weight: bold; color: #4F46E5; }
            .meta-label { font-size: 10pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #4F46E5; color: white; font-weight: 600; padding: 12px 10px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 9pt; }
            /* Title block must not inherit outer table styles */
            .title-block table { margin-top: 0; border-collapse: collapse; }
            .title-block td { border: none !important; padding: 5px 0; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Equipment Inventory Report</h1>
            <div class="subtitle">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
          </div>
          
          <div class="metadata">
            <div class="meta-item">
              <div class="meta-value">${items.length}</div>
              <div class="meta-label">Total Items</div>
            </div>
            <div class="meta-item">
              <div class="meta-value">${new Set(items.map((i) => i.type)).size}</div>
              <div class="meta-label">Equipment Types</div>
            </div>
            <div class="meta-item">
              <div class="meta-value">${items.filter(
      (i) => i.description && i.description !== "No description",
    ).length
      }</div>
              <div class="meta-label">Documented Items</div>
            </div>
            <div class="meta-item">
              <div class="meta-value">${new Date().getFullYear()}</div>
              <div class="meta-label">Report Year</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 10%">Sl No</th>
                <th style="width: 25%">Tag Number</th>
                <th style="width: 20%">Equipment Type</th>
                <th style="width: 45%">Description</th>
              </tr>
            </thead>
            <tbody>
              ${items
        .map(
          (item) => `
                <tr>
                  <td>${item.slNo}</td>
                  <td><strong>${item.tagNo}</strong></td>
                  <td>${item.type}</td>
                  <td>${item.description}</td>
                </tr>
              `,
        )
        .join("")}
            </tbody>
          </table>
          
          ${footerHTML}

          <div class="footer">
            <p>Report ID: EQ-${new Date().getTime().toString().slice(-6)} | Page 1 of 1</p>
            <p>This is a system-generated report. For official use, please verify with the equipment database.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="padding: 10px 30px; background: #4F46E5; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12pt;">Save as PDF</button>
            <p style="color: #6b7280; font-size: 10pt; margin-top: 10px;">Click to open print dialog, then select "Save as PDF" as printer</p>
          </div>
          
          <script>
            window.onload = function() {
              // Focus on the print button
              document.querySelector('button').focus();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(pdfContent);
    printWindow.document.close();
  };

  // Handle export based on selected format
  const handleExport = () => {
    switch (exportFormat) {
      case "csv":
        exportToCSV(items);
        break;
      case "excel":
        exportToExcel(items);
        break;
      case "pdf":
        handlePDFExport();
        break;
      case "print":
        handlePrint();
        break;
    }
  };

  // Handle format selection
  const handleFormatSelect = (format: ExportFormat) => {
    setExportFormat(format);
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={open}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FiDownload className="text-xl" />
            <span>Export Equipment Report</span>
          </div>
          <p className="text-sm text-gray-500 font-normal">
            Review and export your diagram components as a report
          </p>
        </ModalHeader>

        <ModalBody>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Items
              </div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20">
              <div className="text-2xl font-bold">
                {new Set(items.map((i) => i.type)).size}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Unique Types
              </div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20">
              <div className="text-2xl font-bold">
                {
                  items.filter(
                    (i) => i.description && i.description !== "No description",
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                With Description
              </div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20">
              <div className="text-2xl font-bold">
                {items.filter((i) => i.tagNo.startsWith("TAG-")).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Auto-tagged
              </div>
            </div>
          </div>

          {/* Export Format Selection */}
          <div>
            <h3 className="text-sm font-medium mb-2">Export Format</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {formatOptions.map((format) => (
                <Card
                  key={format.key}
                  isHoverable
                  isPressable
                  className={`cursor-pointer transition-all ${exportFormat === format.key
                      ? `ring-2 ring-blue-500 ${format.color} border-2 ${format.borderColor}`
                      : ""
                    }`}
                  onPress={() => handleFormatSelect(format.key)}
                >
                  <CardBody className="p-3">
                    <div className="flex items-center gap-2">
                      {format.icon}
                      <span className="text-sm font-medium">
                        {format.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format.description}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {/* Report Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Components List</h3>
              {items.length > 0 && (
                <div className="text-sm text-gray-500">
                  Showing {items.length} items
                </div>
              )}
            </div>

            <div className="max-h-[400px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <Table
                removeWrapper
                aria-label="Equipment Report Table"
                classNames={{
                  base: "min-h-[200px]",
                  wrapper: "shadow-none",
                }}
              >
                <TableHeader>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Sl No</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Tag No</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Type</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Description</div>
                  </TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={
                    <div className="py-12 text-center">
                      <div className="text-gray-500 mb-2">
                        No components found
                      </div>
                      <div className="text-sm text-gray-400">
                        Add components to your diagram to generate a report
                      </div>
                    </div>
                  }
                  items={items}
                >
                  {(item) => (
                    <TableRow key={`${item.slNo}-${item.tagNo}`}>
                      <TableCell>{item.slNo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {item.tagNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {item.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {item.description}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Export Options Info */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-medium mb-3">Export Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    CSV Format
                  </label>
                  <div className="text-xs text-gray-500">
                    Comma-separated values, compatible with all spreadsheet
                    software
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Excel Format
                  </label>
                  <div className="text-xs text-gray-500">
                    Advanced formatting, formulas, and multiple sheets support
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    PDF Format
                  </label>
                  <div className="text-xs text-gray-500">
                    Print-ready document with professional layout and styling
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Direct Print
                  </label>
                  <div className="text-xs text-gray-500">
                    Send directly to printer or save as PDF from print dialog
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Tooltip content={`Export as ${exportFormat.toUpperCase()}`}>
              <Button
                color="primary"
                isDisabled={items.length === 0}
                startContent={<FiDownload />}
                onPress={handleExport}
              >
                Export {exportFormat.toUpperCase()}
              </Button>
            </Tooltip>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
