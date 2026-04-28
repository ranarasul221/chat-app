import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;

      if (body?.success === false && body?.error) {
        return response.status(status).json(body);
      }

      const message = Array.isArray(body?.message)
        ? body.message[0]
        : body?.message || exception.message || 'Request failed';

      return response.status(status).json({
        success: false,
        error: {
          code: status === HttpStatus.UNAUTHORIZED ? 'UNAUTHORIZED' : 'VALIDATION_ERROR',
          message,
        },
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  }
}
