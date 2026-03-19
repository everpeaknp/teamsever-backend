import { Query } from "mongoose";

interface QueryParams {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  priority?: string;
  [key: string]: any;
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class QueryBuilder {
  static async build<T>(
    query: Query<T[], T>,
    queryParams: QueryParams,
    searchField: string = "title"
  ): Promise<PaginationResult<T>> {
    // Base filter - always exclude deleted
    const filter: any = { isDeleted: false };

    // Search
    if (queryParams.search) {
      filter[searchField] = { $regex: queryParams.search, $options: "i" };
    }

    // Dynamic filtering
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.priority) {
      filter.priority = queryParams.priority;
    }

    // Apply filters
    query = query.find(filter);

    // Pagination
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "10", 10);
    const skip = (page - 1) * limit;

    // Get total count
    const total = await query.model.countDocuments(filter);

    // Execute query with pagination
    const data = await query.skip(skip).limit(limit).sort("-createdAt");

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = QueryBuilder;
export {};
