-- CreateIndex
-- A NULL jobUrl (manually-entered applications) never collides with itself
-- under Postgres unique-index semantics, so this only blocks true
-- duplicates: the same job URL saved twice for the same user.
CREATE UNIQUE INDEX "job_applications_userId_jobUrl_key" ON "job_applications"("userId", "jobUrl");
