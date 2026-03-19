import ExcelJS from 'exceljs';

const CustomTable = require('../models/CustomTable');

/**
 * ExcelExportService
 * Handles Excel export functionality for custom tables
 */
class ExcelExportService {
    /**
     * Export a custom table to Excel format
     * @param tableId - The table ID to export
     * @returns Excel file buffer
     */
    async exportTableToExcel(tableId: string): Promise<Buffer> {
        try {
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            if (table.isDeleted) {
                throw new Error('Cannot export deleted table');
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(table.name);

            // Add header row with bold formatting
            const headerRow = worksheet.addRow(table.columns.map((col: any) => col.title));
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' } // Light gray background
            };

            // Add data rows
            for (const row of table.rows) {
                // Convert plain object to Map if needed
                const dataMap = row.data instanceof Map ? row.data : new Map(Object.entries(row.data || {}));
                const colorsMap = row.colors instanceof Map ? row.colors : new Map(Object.entries(row.colors || {}));
                
                const rowData = table.columns.map((col: any) => {
                    const value = dataMap.get(col.id);
                    return value !== undefined ? value : '';
                });

                const excelRow = worksheet.addRow(rowData);

                // Apply cell colors and formatting
                table.columns.forEach((col: any, colIndex: number) => {
                    const cell = excelRow.getCell(colIndex + 1);

                    // Apply background color if set
                    const color = colorsMap.get(col.id);
                    if (color) {
                        // Convert hex color (#RRGGBB) to Excel ARGB format (FFRRGGBB)
                        const argbColor = 'FF' + color.substring(1);
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: argbColor }
                        };
                    }

                    // Format link columns as hyperlinks
                    if (col.type === 'link') {
                        const value = dataMap.get(col.id);
                        if (value) {
                            try {
                                // Validate URL
                                new URL(value);
                                cell.value = {
                                    text: value,
                                    hyperlink: value
                                };
                                cell.font = {
                                    color: { argb: 'FF0000FF' }, // Blue
                                    underline: true
                                };
                            } catch {
                                // If invalid URL, just set as text
                                cell.value = value;
                            }
                        }
                    }
                });
            }

            // Auto-fit column widths
            worksheet.columns.forEach((column: any) => {
                let maxLength = 0;
                if (column && column.eachCell) {
                    column.eachCell({ includeEmpty: true }, (cell: any) => {
                        const cellValue = cell.value ? cell.value.toString() : '';
                        maxLength = Math.max(maxLength, cellValue.length);
                    });
                }
                column.width = Math.min(Math.max(maxLength + 2, 10), 50); // Min 10, max 50
            });

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer();
            
            console.log(`[ExcelExportService] Exported table ${tableId} to Excel`);
            return Buffer.from(buffer);
        } catch (error) {
            console.error(`[ExcelExportService] Error exporting table to Excel:`, error);
            throw error;
        }
    }
}

export default new ExcelExportService();
