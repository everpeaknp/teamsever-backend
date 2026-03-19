import mongoose from 'mongoose';

const CustomTable = require('../models/CustomTable');
const Space = require('../models/Space');
const EntitlementService = require('./entitlementService').default;

interface IColumn {
    id: string;
    title: string;
    type: 'text' | 'link' | 'number';
}

/**
 * CustomTableService
 * Handles CRUD operations for custom tables
 */
class CustomTableService {
    /**
     * Create a new custom table
     * @param spaceId - The space ID where the table will be created
     * @param name - The table name
     * @param userId - The user creating the table
     * @param initialColumns - Optional initial columns
     * @param initialRowCount - Optional number of initial empty rows to create
     * @returns Created table
     */
    async createTable(
        spaceId: string,
        name: string,
        userId: string,
        initialColumns?: IColumn[],
        initialRowCount?: number
    ): Promise<any> {
        try {
            // Verify space exists
            const space = await Space.findById(spaceId);
            if (!space) {
                throw new Error('Space not found');
            }

            // Check entitlement
            const entitlement = await EntitlementService.canCreateTable(userId);
            if (!entitlement.allowed) {
                throw new Error(entitlement.reason || 'Cannot create table');
            }

            // Create initial empty rows if specified
            const rows = [];
            if (initialRowCount && initialRowCount > 0) {
                for (let i = 0; i < initialRowCount; i++) {
                    rows.push({
                        id: new mongoose.Types.ObjectId().toString(),
                        data: {},
                        colors: {}
                    });
                }
            }

            // Create table
            const table = await CustomTable.create({
                spaceId,
                name,
                columns: initialColumns || [],
                rows
            });

            // Invalidate both usage and entitlement caches
            EntitlementService.invalidateUsageCache(userId);
            EntitlementService.invalidateEntitlementCache(userId);

            console.log(`[CustomTableService] Created table ${table._id} in space ${spaceId} with ${rows.length} initial rows`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error creating table:`, error);
            throw error;
        }
    }

    /**
     * Add a column to a table
     * @param tableId - The table ID
     * @param title - Column title
     * @param type - Column type (text, link, number)
     * @returns Updated table
     */
    async addColumn(
        tableId: string,
        title: string,
        type: 'text' | 'link' | 'number'
    ): Promise<any> {
        try {
            const columnId = new mongoose.Types.ObjectId().toString();

            const table = await CustomTable.findByIdAndUpdate(
                tableId,
                {
                    $push: {
                        columns: { id: columnId, title, type }
                    }
                },
                { new: true }
            );

            if (!table) {
                throw new Error('Table not found');
            }

            console.log(`[CustomTableService] Added column ${columnId} to table ${tableId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error adding column:`, error);
            throw error;
        }
    }

    /**
     * Update a column's title or type
     * @param tableId - The table ID
     * @param columnId - The column ID
     * @param updates - Updates to apply (title and/or type)
     * @returns Updated table
     */
    async updateColumn(
        tableId: string,
        columnId: string,
        updates: { title?: string; type?: 'text' | 'link' | 'number' }
    ): Promise<any> {
        try {
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            // Find and update the column
            const column = table.columns.find((col: any) => col.id === columnId);
            if (!column) {
                throw new Error('Column not found');
            }

            if (updates.title !== undefined) {
                column.title = updates.title;
            }
            if (updates.type !== undefined) {
                column.type = updates.type;
            }

            await table.save();

            console.log(`[CustomTableService] Updated column ${columnId} in table ${tableId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error updating column:`, error);
            throw error;
        }
    }

    /**
     * Delete a column and clean up its data from all rows
     * @param tableId - The table ID
     * @param columnId - The column ID
     * @returns Updated table
     */
    async deleteColumn(tableId: string, columnId: string): Promise<any> {
        try {
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            // Remove column
            table.columns = table.columns.filter((col: any) => col.id !== columnId);

            // Remove data and colors for this column from all rows
            table.rows.forEach((row: any) => {
                if (row.data) {
                    row.data.delete(columnId);
                }
                if (row.colors) {
                    row.colors.delete(columnId);
                }
            });

            await table.save();

            console.log(`[CustomTableService] Deleted column ${columnId} from table ${tableId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error deleting column:`, error);
            throw error;
        }
    }

    /**
     * Add a row to a table
     * @param tableId - The table ID
     * @param userId - The user adding the row
     * @param initialData - Optional initial data for the row
     * @returns Object with updated table and new row ID
     */
    async addRow(
        tableId: string,
        userId: string,
        initialData?: Record<string, any>
    ): Promise<{ table: any; rowId: string }> {
        try {
            // Check entitlement
            const entitlement = await EntitlementService.canAddRow(userId);
            if (!entitlement.allowed) {
                throw new Error(entitlement.reason || 'Cannot add row');
            }

            const rowId = new mongoose.Types.ObjectId().toString();

            const table = await CustomTable.findByIdAndUpdate(
                tableId,
                {
                    $push: {
                        rows: {
                            id: rowId,
                            data: initialData || {},
                            colors: {}
                        }
                    }
                },
                { new: true }
            );

            if (!table) {
                throw new Error('Table not found');
            }

            // Invalidate both usage and entitlement caches
            EntitlementService.invalidateUsageCache(userId);
            EntitlementService.invalidateEntitlementCache(userId);

            console.log(`[CustomTableService] Added row ${rowId} to table ${tableId}`);
            return { table, rowId };
        } catch (error) {
            console.error(`[CustomTableService] Error adding row:`, error);
            throw error;
        }
    }

    /**
     * Delete a row from a table
     * @param tableId - The table ID
     * @param rowId - The row ID
     * @param userId - The user deleting the row
     * @returns Updated table
     */
    async deleteRow(tableId: string, rowId: string, userId: string): Promise<any> {
        try {
            const table = await CustomTable.findByIdAndUpdate(
                tableId,
                {
                    $pull: { rows: { id: rowId } }
                },
                { new: true }
            );

            if (!table) {
                throw new Error('Table not found');
            }

            // Invalidate both usage and entitlement caches
            EntitlementService.invalidateUsageCache(userId);
            EntitlementService.invalidateEntitlementCache(userId);

            console.log(`[CustomTableService] Deleted row ${rowId} from table ${tableId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error deleting row:`, error);
            throw error;
        }
    }

    /**
     * Update a cell value with type validation
     * @param tableId - The table ID
     * @param rowId - The row ID
     * @param columnId - The column ID
     * @param value - The new value
     * @returns Updated table
     */
    async updateCell(
        tableId: string,
        rowId: string,
        columnId: string,
        value: any
    ): Promise<any> {
        try {
            console.log(`[CustomTableService] updateCell called:`, { tableId, rowId, columnId, value });
            
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            // Find column to get type
            const column = table.columns.find((col: any) => col.id === columnId);
            if (!column) {
                throw new Error('Column not found');
            }

            // Validate value based on column type
            const validatedValue = this.validateCellValue(value, column.type);
            console.log(`[CustomTableService] Validated value:`, validatedValue);

            // Find and update row
            const row = table.rows.find((r: any) => r.id === rowId);
            if (!row) {
                throw new Error('Row not found');
            }

            console.log(`[CustomTableService] Before update - row.data:`, row.data);
            row.data.set(columnId, validatedValue);
            console.log(`[CustomTableService] After set - row.data:`, row.data);
            
            // Mark the path as modified to ensure Mongoose saves it
            table.markModified('rows');
            
            await table.save();
            console.log(`[CustomTableService] Table saved successfully`);

            // Verify the save by fetching again
            const verifyTable = await CustomTable.findById(tableId);
            const verifyRow = verifyTable.rows.find((r: any) => r.id === rowId);
            console.log(`[CustomTableService] After save verification - row.data:`, verifyRow.data);

            console.log(`[CustomTableService] Updated cell in table ${tableId}, row ${rowId}, column ${columnId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error updating cell:`, error);
            throw error;
        }
    }

    /**
     * Update cell background color
     * @param tableId - The table ID
     * @param rowId - The row ID
     * @param columnId - The column ID
     * @param color - Hex color string or null to remove
     * @returns Updated table
     */
    async updateCellColor(
        tableId: string,
        rowId: string,
        columnId: string,
        color: string | null
    ): Promise<any> {
        try {
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            const row = table.rows.find((r: any) => r.id === rowId);
            if (!row) {
                throw new Error('Row not found');
            }

            if (color === null) {
                row.colors.delete(columnId);
            } else {
                // Validate hex color format
                if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    throw new Error('Invalid color format. Must be hexadecimal (#RRGGBB)');
                }
                row.colors.set(columnId, color);
            }

            // Mark the path as modified to ensure Mongoose saves it
            table.markModified('rows');
            
            await table.save();

            console.log(`[CustomTableService] Updated cell color in table ${tableId}, row ${rowId}, column ${columnId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error updating cell color:`, error);
            throw error;
        }
    }

    /**
     * Update cell text color
     * @param tableId - The table ID
     * @param rowId - The row ID
     * @param columnId - The column ID
     * @param color - Hex color string or null to remove
     * @returns Updated table
     */
    async updateCellTextColor(
        tableId: string,
        rowId: string,
        columnId: string,
        color: string | null
    ): Promise<any> {
        try {
            const table = await CustomTable.findById(tableId);
            if (!table) {
                throw new Error('Table not found');
            }

            const row = table.rows.find((r: any) => r.id === rowId);
            if (!row) {
                throw new Error('Row not found');
            }

            if (color === null) {
                row.textColors.delete(columnId);
            } else {
                // Validate hex color format
                if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    throw new Error('Invalid color format. Must be hexadecimal (#RRGGBB)');
                }
                row.textColors.set(columnId, color);
            }

            // Mark the path as modified to ensure Mongoose saves it
            table.markModified('rows');
            
            await table.save();

            console.log(`[CustomTableService] Updated cell text color in table ${tableId}, row ${rowId}, column ${columnId}`);
            return table;
        } catch (error) {
            console.error(`[CustomTableService] Error updating cell text color:`, error);
            throw error;
        }
    }

    /**
     * Soft delete a table
     * @param tableId - The table ID
     * @param userId - The user deleting the table
     */
    async deleteTable(tableId: string, userId: string): Promise<void> {
        try {
            const table = await CustomTable.findByIdAndUpdate(
                tableId,
                {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            );

            if (!table) {
                throw new Error('Table not found');
            }

            // Invalidate both usage and entitlement caches
            EntitlementService.invalidateUsageCache(userId);
            EntitlementService.invalidateEntitlementCache(userId);

            console.log(`[CustomTableService] Soft deleted table ${tableId}`);
        } catch (error) {
            console.error(`[CustomTableService] Error deleting table:`, error);
            throw error;
        }
    }

    /**
     * Validate cell value based on column type
     * @param value - The value to validate
     * @param type - The column type
     * @returns Validated value
     * @throws Error if validation fails
     */
    private validateCellValue(value: any, type: 'text' | 'link' | 'number'): any {
        switch (type) {
            case 'text':
                return String(value);

            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    throw new Error('Invalid number value');
                }
                return num;

            case 'link':
                const urlStr = String(value);
                // Basic URL validation
                try {
                    new URL(urlStr);
                    return urlStr;
                } catch {
                    throw new Error('Invalid URL format');
                }

            default:
                return value;
        }
    }
}

export default new CustomTableService();
