# Backend core verification

## Safety prerequisites

1. Revoke and reissue any AI credential that has ever appeared in Git or chat.
2. Configure TLS on MariaDB or connect through an encrypted tunnel.
3. Create separate accounts: an application account with DML only and a migration account with DDL.
4. Fill the ignored root `.env`; never paste its values into Git, Postman exports, or chat.
5. Run V5–V7 only after backing up the database. V5 preserves `members` but resets existing non-member core tables.

## Local ports

| Service | Host port | Container port |
|---|---:|---:|
| Nginx | 80 | 80 |
| Backend | 8081 | 8080 |
| FastAPI similarity | 8000 | 8000 |
| Flask logo generation | 5000 | 5000 |
| Optional local MariaDB | 3307 | 3306 |

The current branch does not contain the latest Flask logo-generation source. Build/tag it as `genmark-logo-ai:local` after the AI branch is integrated, then start with `docker compose --profile logo-ai up --build`.

## Migration gate

CI/CD must run `validate` and `migrate` against `database/migration` with `clean` disabled, using the DDL account. Deploy the backend only if migration succeeds. The backend itself has Flyway disabled and Hibernate set to `validate`.

## Postman flow

Use `Authorization: Bearer {{accessToken}}` for every `/api/v1/**` endpoint except `/auth/**`.

1. Login, then confirm `user.onboardingCompleted` is `false` for a new member.
2. `PUT /api/v1/me/onboarding` using either `SUBMITTED` with `initialProject`, or `SKIPPED` without it.
3. Repeat the same PUT and confirm the original completion result is returned (idempotent).
4. Login again and confirm `onboardingCompleted=true`.
5. Create/update/read the initial project.
6. POST a logo generation with a unique `Idempotency-Key`; poll the returned generation ID.
7. Confirm exactly four candidates and select one.
8. POST a trademark analysis; poll it and fetch its three matches.
9. Repeat ownership checks with a second member and expect 404 for another member's public IDs.

## DBeaver checks

```sql
SELECT id, email, provider, created_at FROM members ORDER BY id;
SELECT member_id, details_decision, initial_project_id, completed_at FROM member_onboardings;
SELECT public_id, member_id, status, brand_name, logo_style FROM projects;
SELECT public_id, project_id, status, candidate_count, error_code FROM logo_generations;
SELECT generation_id, candidate_order, storage_key, selected FROM logo_candidates ORDER BY generation_id, candidate_order;
SELECT public_id, project_id, candidate_id, status, max_similarity, risk_level FROM trademark_analyses;
SELECT analysis_id, match_rank, application_number, similarity FROM trademark_matches ORDER BY analysis_id, match_rank;
```

The database must contain storage paths only; Base64 image data must not appear in `logo_candidates`.
