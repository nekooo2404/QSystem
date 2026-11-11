import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { codedUnauthorized, IamService } from './iam.service';

export const PUBLIC_KEY = 'qsystem:isPublic';

/** Marks a route public (login/refresh). Logout is public-idempotent. */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' };
    }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
      // Coded 401 per brief minimum {code,message} — never Nest's default
      // uncoded {statusCode,message} shape.
      throw codedUnauthorized('UNAUTHORIZED', 'Missing or invalid access token');
    }
    req.user = this.iam.verifyAccess(header.slice('Bearer '.length));
    return true;
  }
}
