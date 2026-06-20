import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@trustroom/db';
import { randomUUID } from 'crypto';

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const requestIdHeader = request.headers?.['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string' && requestIdHeader.length > 0
        ? requestIdHeader
        : randomUUID();

    const error = this.toErrorBody(exception, requestId);
    response.status(error.statusCode).json(error);
  }

  private toErrorBody(exception: unknown, requestId: string): ErrorBody {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'RESOURCE_CONFLICT',
          message: 'Resource conflict.',
          requestId,
          details: exception.meta,
        };
      }

      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found.',
          requestId,
        };
      }
    }

    if (exception instanceof BadRequestException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const body = response as { message?: string | string[]; code?: string; details?: unknown };
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: body.code ?? 'VALIDATION_FAILED',
          message: Array.isArray(body.message)
            ? body.message.join('; ')
            : body.message ?? 'Validation failed.',
          requestId,
          ...(body.details === undefined ? {} : { details: body.details }),
        };
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          statusCode,
          code: this.defaultCodeForStatus(statusCode),
          message: response,
          requestId,
        };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as {
          code?: string;
          message?: string | string[];
          details?: unknown;
          statusCode?: number;
        };
        return {
          statusCode: body.statusCode ?? statusCode,
          code: body.code ?? this.defaultCodeForStatus(statusCode),
          message: Array.isArray(body.message)
            ? body.message.join('; ')
            : body.message ?? 'Request failed.',
          requestId,
          ...(body.details === undefined ? {} : { details: body.details }),
        };
      }
    }

    console.error(exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
      requestId,
    };
  }

  private defaultCodeForStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_INVALID';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'REQUEST_FAILED';
    }
  }
}
