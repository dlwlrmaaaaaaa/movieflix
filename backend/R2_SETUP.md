# Private Cloudflare R2 setup

Create a private bucket and add the `CLOUDFLARE_R2_*` values from `.env.example` to the backend environment. Do not put these values in Expo public environment variables.

The mobile app uploads directly to short-lived presigned R2 multipart URLs. Configure this bucket CORS policy, replacing the origins with the app domains you use for web builds (native Android requests do not send a browser Origin):

```json
[
  {
    "AllowedOrigins": ["https://your-web-app.example"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 900
  }
]
```

Each multipart part is 8 MiB. R2 requires every part except the final one to be at least 5 MiB. The default application limit is 20 GiB per movie and 100 GiB per user; set `R2_MAX_MOVIE_BYTES` and `R2_USER_QUOTA_BYTES` to change them.

R2 charges for stored data and object operations. This implementation avoids application-server media bandwidth: only signed multipart upload URLs and signed one-hour playback URLs pass through the API. Deleting a library movie removes the R2 object; cancelling an upload aborts its multipart upload.

## First administrator

Register the administrator normally, then grant the role from the backend host:

```powershell
npm.cmd run admin:grant -- admin@example.com
```

Alternatively set `ADMIN_BOOTSTRAP_EMAIL` before that person registers, then remove the variable after registration. Roles are enforced by the backend; changing the mobile UI cannot grant upload or deletion access.
