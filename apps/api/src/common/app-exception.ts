import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
      status,
    );
  }
}
