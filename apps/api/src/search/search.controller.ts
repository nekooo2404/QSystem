import { Controller, Get, HttpException, HttpStatus, Inject, Query } from '@nestjs/common';
import type { SearchResult } from '@qsystem/contracts';
import { SearchService } from './search.service';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from '../org/abilities.factory';
import type { ScopeViewer } from '../prisma/prisma.service';

function codedBadRequest(code: string, message: string): HttpException {
  return new HttpException({ code, message }, HttpStatus.BAD_REQUEST);
}

/**
 * SearchController (Task 7): GET /search?q=&limit=&offset=
 *
 * The `scope` query param from the plan's interface is informational only —
 * the effective scope ALWAYS comes from the authenticated viewer
 * (AbilitiesFactory.resolveViewer), never from the request, so a caller
 * cannot widen results. Invalid/missing `q` is a coded 400 (the contracts
 * schema requires q with min length 1).
 */
@Controller('search')
export class SearchController {
  // Explicit tokens — esbuild (vitest) does not emit decorator metadata.
  constructor(
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  @Get()
  async find(
    @CurrentUser() user: RequestViewer | undefined,
    @Query() query: Record<string, unknown>,
  ): Promise<SearchResult> {
    if (!user?.id) {
      throw new HttpException(
        { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q.length === 0) {
      throw codedBadRequest('BAD_REQUEST', 'q is required');
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    try {
      return await this.search.search(viewer, {
        q,
        limit: query.limit,
        offset: query.offset,
      });
    } catch (err) {
      // Contracts schema violations (bad limit/offset) surface as coded 400
      // rather than an uncoded 500.
      if (err instanceof Error && err.name === 'ZodError') {
        throw codedBadRequest('BAD_REQUEST', 'invalid search query');
      }
      throw err;
    }
  }
}
