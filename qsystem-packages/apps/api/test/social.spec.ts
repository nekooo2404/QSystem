import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { applyHttpHardening } from '../src/common/http-hardening';

describe('QSocial Internal Feed, Reactions, Comments & Permissions', () => {
  const runId = randomUUID().slice(0, 8);
  const ownerUrl = process.env.RLS_OWNER_URL || process.env.DATABASE_URL;
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerUrl } } });

  let app: NestExpressApplication;
  let deptId = '';
  let directorId = '';
  let managerId = '';
  let employeeId = '';
  const createdPostIds: string[] = [];

  const password = 'SocialTestPass!2026';
  const directorEmail = `soc-dir-${runId}@qsystem.local`;
  const managerEmail = `soc-mgr-${runId}@qsystem.local`;
  const empEmail = `soc-emp-${runId}@qsystem.local`;

  let directorToken = '';
  let managerToken = '';
  let empToken = '';

  async function loginViaApi(email: string, suiteId: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-test-suite-id', suiteId)
      .send({ email, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.TEST_JWT_SECRET ??= 'soc-test-jwt-secret-not-for-prod-use-000';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
    applyHttpHardening(app, { bodyLimit: '64kb' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const passwordHash = await argon2.hash(password);
    const dept = await ownerPrisma.department.create({ data: { name: `Social Dept ${runId}` } });
    deptId = dept.id;

    const dir = await ownerPrisma.user.create({
      data: { email: directorEmail, name: 'Giám đốc Bảng tin', passwordHash, role: 'DIRECTOR' },
    });
    const mgr = await ownerPrisma.user.create({
      data: {
        email: managerEmail,
        name: 'Quản lý Bảng tin',
        passwordHash,
        role: 'MANAGER',
        departmentId: deptId,
        reportsToId: dir.id,
      },
    });
    await ownerPrisma.department.update({ where: { id: deptId }, data: { managerId: mgr.id } });
    const emp = await ownerPrisma.user.create({
      data: {
        email: empEmail,
        name: 'Nhân viên Bảng tin',
        passwordHash,
        role: 'EMPLOYEE',
        departmentId: deptId,
        reportsToId: mgr.id,
      },
    });

    directorId = dir.id;
    managerId = mgr.id;
    employeeId = emp.id;

    directorToken = await loginViaApi(directorEmail, `soc-dir-${runId}`);
    managerToken = await loginViaApi(managerEmail, `soc-mgr-${runId}`);
    empToken = await loginViaApi(empEmail, `soc-emp-${runId}`);
  });

  afterAll(async () => {
    const userIds = [directorId, managerId, employeeId].filter(Boolean);
    if (createdPostIds.length > 0) {
      await ownerPrisma.socialPost.deleteMany({ where: { id: { in: createdPostIds } } });
    }
    if (userIds.length > 0) {
      await ownerPrisma.socialPostLike.deleteMany({ where: { userId: { in: userIds } } });
      await ownerPrisma.socialComment.deleteMany({ where: { authorId: { in: userIds } } });
      await ownerPrisma.socialPost.deleteMany({ where: { authorId: { in: userIds } } });
      await ownerPrisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await ownerPrisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await ownerPrisma.department.updateMany({
        where: { managerId: { in: userIds } },
        data: { managerId: null },
      });
      await ownerPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (deptId) {
      await ownerPrisma.department.deleteMany({ where: { id: deptId } });
    }
    await ownerPrisma.$disconnect();
    await app.close();
  });

  it('creates posts, blocks EMPLOYEE from pinning, allows MANAGER/DIRECTOR pin & filters feed', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/social/posts')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ content: `Bai ghim trai phep ${runId}`, category: 'ANNOUNCEMENT', pinned: true })
      .expect(403);

    const empRes = await request(server)
      .post('/social/posts')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        content: `Kinh nghiem quy trinh kiem thu ${runId}`,
        category: 'SHARING',
        departmentId: deptId,
      })
      .expect(201);

    const empPostId = empRes.body.post.id as string;
    createdPostIds.push(empPostId);
    expect(empRes.body.post.authorId).toBe(employeeId);
    expect(empRes.body.post.pinned).toBe(false);

    const mgrRes = await request(server)
      .post('/social/posts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        content: `Thong bao hop giao ban ${runId}`,
        category: 'ANNOUNCEMENT',
        departmentId: deptId,
        pinned: true,
      })
      .expect(201);

    const mgrPostId = mgrRes.body.post.id as string;
    createdPostIds.push(mgrPostId);
    expect(mgrRes.body.post.pinned).toBe(true);

    const filteredRes = await request(server)
      .get('/social/posts')
      .query({ departmentId: deptId, pinnedOnly: 'true', q: runId })
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);

    expect(filteredRes.body.items).toHaveLength(1);
    expect(filteredRes.body.items[0].id).toBe(mgrPostId);

    const categoryRes = await request(server)
      .get('/social/posts')
      .query({ category: 'SHARING', q: runId })
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    expect(categoryRes.body.items.some((p: { id: string }) => p.id === empPostId)).toBe(true);
  });

  it('toggles likes, adds comments, and enforces author/DIRECTOR permissions on update/delete', async () => {
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post('/social/posts')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ content: `Bai chia se tuong tac ${runId}`, category: 'KUDOS' })
      .expect(201);

    const postId = createRes.body.post.id as string;
    createdPostIds.push(postId);

    const likeOnRes = await request(server)
      .post(`/social/posts/${postId}/like`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(201);
    expect(likeOnRes.body.liked).toBe(true);
    expect(likeOnRes.body.post.likeCount).toBe(1);
    expect(likeOnRes.body.post.likedByMe).toBe(true);

    const commentRes = await request(server)
      .post(`/social/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ content: `Chuc mung nhom da hoan thanh ${runId}` })
      .expect(201);
    expect(commentRes.body.post.commentCount).toBe(1);
    expect(commentRes.body.comment.authorId).toBe(managerId);

    const likeOffRes = await request(server)
      .post(`/social/posts/${postId}/like`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(201);
    expect(likeOffRes.body.liked).toBe(false);
    expect(likeOffRes.body.post.likeCount).toBe(0);

    // EMPLOYEE cannot pin; MANAGER cannot delete another user's post; DIRECTOR can delete
    await request(server)
      .patch(`/social/posts/${postId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ pinned: true })
      .expect(403);

    await request(server)
      .delete(`/social/posts/${postId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);

    await request(server)
      .delete(`/social/posts/${postId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
  });
});

