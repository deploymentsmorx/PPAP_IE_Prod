# PPAP

PPAP submission and approval workflow built with Next.js, PostgreSQL, Prisma,
and AWS S3 file storage.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `AUTH_SECRET`, and
   `CRON_SECRET`.
3. For AWS S3, uncomment the S3 variables in `.env.example`, set the bucket's
   `S3_REGION`, and use the deployment server's IAM role or its secret store
   for AWS credentials. Leave them commented for local-disk storage.
4. Apply the checked-in database migrations with `npx prisma migrate deploy`.
5. Generate Prisma Client with `npx prisma generate`.
6. Start the app with `npm run dev` and open <http://localhost:3000>.

For an empty development database only, `npx prisma db seed` loads demo data
and login accounts. Do not run the seed command against the production
database.

Set `DIRECT_URL` only when Prisma migrations need a direct PostgreSQL
connection and the app uses a pooled `DATABASE_URL`.

The S3 identity needs `s3:GetObject` and `s3:PutObject` access to
`arn:aws:s3:::ppap-ie-prod/ppap_data_prod/*`.

## Email

`docker-compose.yml` runs Maildev for local magic-link email. Its inbox UI is
at <http://localhost:1080>. In production, set `EMAIL_SERVER` and `EMAIL_FROM`
to the deployment mail service.
