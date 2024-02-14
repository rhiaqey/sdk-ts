import { Observable, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

export const genericRetryStrategy =
    ({
        maxRetryAttempts = 3,
        retryTimeout = 1000,
    }: {
        maxRetryAttempts?: number;
        retryTimeout?: number;
    } = {}) =>
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (attempts: Observable<any>) => {
        return attempts.pipe(
            mergeMap((error, i) => {
                const retryAttempt = i + 1;

                if (retryAttempt > maxRetryAttempts) {
                    return throwError(() => error);
                }

                return timer(retryAttempt * retryTimeout);
            }),
        );
    };
