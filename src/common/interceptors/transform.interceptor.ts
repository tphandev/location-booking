import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // 204 No Content — return as-is (body must be empty)
        if (res.statusCode === 204) return data;

        // Paginated responses already carry { data, meta } — pass through
        if (
          data !== null &&
          data !== undefined &&
          typeof data === 'object' &&
          'data' in data
        ) {
          return data;
        }

        return { data };
      }),
    );
  }
}
