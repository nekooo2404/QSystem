import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from '../org/abilities.factory';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  // Explicit @Inject tokens — Vitest compiles via esbuild without decorator metadata.
  constructor(
    @Inject(SocialService) private readonly social: SocialService,
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
  ) {}

  private async viewer(user: RequestViewer | undefined) {
    return this.abilities.resolveViewer({
      id: user?.id ?? '',
      role: user?.role ?? 'EMPLOYEE',
    });
  }

  @Get('posts')
  async listPosts(
    @CurrentUser() user: RequestViewer | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.social.listPosts(await this.viewer(user), query);
  }

  @Post('posts')
  async createPost(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: unknown,
  ) {
    return this.social.createPost(await this.viewer(user), body);
  }

  @Patch('posts/:id')
  async updatePost(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.social.updatePost(await this.viewer(user), id, body);
  }

  @Delete('posts/:id')
  async deletePost(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
  ) {
    return this.social.deletePost(await this.viewer(user), id);
  }

  @Post('posts/:id/like')
  async toggleLike(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
  ) {
    return this.social.toggleLike(await this.viewer(user), id);
  }

  @Post('posts/:id/comments')
  async addComment(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.social.addComment(await this.viewer(user), id, body);
  }

  @Post('posts/:id/save')
  async toggleSave(@CurrentUser() user: RequestViewer | undefined, @Param('id') id: string) {
    return this.social.toggleSave(await this.viewer(user), id);
  }

  @Post('posts/:id/hide')
  async toggleHide(@CurrentUser() user: RequestViewer | undefined, @Param('id') id: string) {
    return this.social.toggleHide(await this.viewer(user), id);
  }

  @Get('saved')
  async listSaved(@CurrentUser() user: RequestViewer | undefined) {
    return this.social.listSavedIds(await this.viewer(user));
  }

  @Get('hidden')
  async listHidden(@CurrentUser() user: RequestViewer | undefined) {
    return this.social.listHiddenIds(await this.viewer(user));
  }
}

