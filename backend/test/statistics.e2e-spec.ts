import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Statistics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: RegisteredUser;
  let authHeader: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    user = await registerAndLogin(app);
    authHeader = `Bearer ${user.accessToken}`;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await closeTestApp({ app, prisma });
  });

  it('returns zeroed statistics for a user with no applications', async () => {
    const response = await request(app.getHttpServer())
      .get('/applications/statistics')
      .set('Authorization', authHeader)
      .expect(200);

    expect(response.body).toEqual({
      totalApplications: 0,
      byStatus: { applied: 0, assessment: 0, interview: 0, offer: 0, rejected: 0 },
      rates: {
        assessmentRate: 0,
        interviewRate: 0,
        offerRate: 0,
        rejectionRate: 0,
        interviewToOfferRate: 0,
      },
      analytics: {
        activePipeline: 0,
        successfulApplications: 0,
        averageApplicationsPerMonth: 0,
        monthlyApplications: [],
      },
    });
  });

  it('computes counts, rates, and monthly aggregation from seeded data', async () => {
    async function createWithStatus(
      status: 'APPLIED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED',
      createdAt: string,
    ) {
      const created = await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', authHeader)
        .send({ company: 'Co', position: 'Engineer' })
        .expect(201);

      if (status !== 'APPLIED') {
        // Walk through the forward-only workflow to reach the target status
        // (REJECTED is reachable directly from APPLIED).
        const path: Record<string, string[]> = {
          ASSESSMENT: ['ASSESSMENT'],
          INTERVIEW: ['ASSESSMENT', 'INTERVIEW'],
          OFFER: ['ASSESSMENT', 'INTERVIEW', 'OFFER'],
          REJECTED: ['REJECTED'],
        };

        for (const step of path[status]) {
          await request(app.getHttpServer())
            .patch(`/applications/${created.body.id}/status`)
            .set('Authorization', authHeader)
            .send({ status: step })
            .expect(200);
        }
      }

      await prisma.jobApplication.update({
        where: { id: created.body.id },
        data: { createdAt: new Date(createdAt) },
      });

      return created.body.id;
    }

    // 2 APPLIED and 1 ASSESSMENT in January; 1 INTERVIEW, 1 OFFER, 1 REJECTED in February.
    await createWithStatus('APPLIED', '2026-01-05T00:00:00.000Z');
    await createWithStatus('APPLIED', '2026-01-10T00:00:00.000Z');
    await createWithStatus('ASSESSMENT', '2026-01-20T00:00:00.000Z');
    await createWithStatus('INTERVIEW', '2026-02-05T00:00:00.000Z');
    await createWithStatus('OFFER', '2026-02-10T00:00:00.000Z');
    await createWithStatus('REJECTED', '2026-02-15T00:00:00.000Z');

    const response = await request(app.getHttpServer())
      .get('/applications/statistics')
      .set('Authorization', authHeader)
      .expect(200);

    expect(response.body.totalApplications).toBe(6);
    expect(response.body.byStatus).toEqual({
      applied: 2,
      assessment: 1,
      interview: 1,
      offer: 1,
      rejected: 1,
    });
    // (assessment + interview + offer) / total = 3 / 6
    expect(response.body.rates.assessmentRate).toBe(50);
    // (interview + offer) / total = 2 / 6
    expect(response.body.rates.interviewRate).toBe(33.33);
    expect(response.body.rates.offerRate).toBe(16.67);
    expect(response.body.rates.rejectionRate).toBe(16.67);
    // offer / (interview + offer) = 1 / 2
    expect(response.body.rates.interviewToOfferRate).toBe(50);
    expect(response.body.analytics.activePipeline).toBe(4);
    expect(response.body.analytics.successfulApplications).toBe(1);
    expect(response.body.analytics.monthlyApplications).toEqual([
      { month: '2026-01', count: 3 },
      { month: '2026-02', count: 3 },
    ]);
  });

  it('only aggregates the caller\'s own applications', async () => {
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', authHeader)
      .send({ company: 'Mine', position: 'Engineer' })
      .expect(201);

    const otherUser = await registerAndLogin(app);
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .send({ company: 'Theirs', position: 'Engineer' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .send({ company: 'Theirs Too', position: 'Engineer' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/applications/statistics')
      .set('Authorization', authHeader)
      .expect(200);

    expect(response.body.totalApplications).toBe(1);
  });
});
