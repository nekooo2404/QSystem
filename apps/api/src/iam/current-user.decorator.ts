import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestViewer } from './iam.service';

/**
 * Reads the viewer attached by JwtAuthGuard (`request.user`), which Task 4
 * consumes via `PrismaService.forUser`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestViewer => {
    const req = ctx.switchToHttp().getRequest<{ user: RequestViewer }>();
    return req.user;
  },
);
