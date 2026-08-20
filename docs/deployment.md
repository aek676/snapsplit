# Deployment notes

## Web build configuration

The web bundle bakes the API base URL in at build time from `VITE_API_URL`
(see `apps/web/.env.example`). The build fails if it is unset, so deploy
pipelines must provide it.

## Receipt image retention

Sessions expire through the MongoDB TTL index on `createdAt`
(`apps/api/src/schemas/session.ts`, 90 days). TTL deletion happens inside
MongoDB and never notifies the API, so the receipt image a session references
in GCS is **not** deleted with it — only the explicit
`DELETE /sessions/:sessionId` removes the blob eagerly.

To keep orphaned images from accumulating, the bucket named by `GCS_BUCKET`
must carry an Object Lifecycle Management rule that deletes objects at the
same horizon as the TTL index (or slightly beyond it, so no image outlives
its session by much):

```json
{
  "rule": [{ "action": { "type": "Delete" }, "condition": { "age": 90 } }]
}
```

Apply it with:

```sh
gcloud storage buckets update gs://$GCS_BUCKET --lifecycle-file=lifecycle.json
```

Keep the rule's `age` in sync with the TTL index whenever either changes.
