# Redeployment Instructions for Fashion Calendar Merge Service

If you need to redeploy the merge service after making changes, follow these step-by-step instructions.

## 1. Before Redeployment

Before redeploying, make sure you've made all necessary changes to:

- `index.ts` - Main service code
- `package.json` - Dependencies and scripts
- Environment variables (if any have changed)

## 2. Local Testing

Always test your changes locally before redeployment:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm run serve
```

Verify the service works by testing both:
- Health endpoint: `http://localhost:4000/health`
- Merge endpoint: Use the test-merge.js script

## 3. Commit and Push Changes

Commit your changes to the repository that's connected to Render:

```bash
git add .
git commit -m "Update merge service with [describe changes]"
git push origin main
```

## 4. Manual Redeployment on Render

If you're not using automatic deployments:

1. Log in to your [Render Dashboard](https://dashboard.render.com)
2. Navigate to the **merge-service** web service
3. Click on **Manual Deploy** > **Deploy latest commit**
4. Monitor the build logs for any errors

## 5. Verify Deployment

After Render indicates the deployment is complete:

1. Test the health endpoint:
   ```
   curl https://merge-service-csqj.onrender.com/health
   ```

2. Run the test-merge.js script with the deployed service URL:
   ```
   node test-merge.js
   ```

3. Check that the service correctly:
   - Authenticates requests with the API key
   - Processes and merges images
   - Uploads to Supabase
   - Returns valid signed URLs

## 6. Troubleshooting Common Issues

If your deployment fails or the service doesn't work correctly:

1. **Build Failures**
   - Check for TypeScript errors in the build logs
   - Verify all dependencies are correctly listed in package.json
   - Ensure your Node.js version is compatible (Node 18+)

2. **Runtime Errors**
   - Check Render logs for runtime exceptions
   - Verify all environment variables are set correctly
   - Check that the Supabase bucket exists and is accessible

3. **Connection Issues**
   - Verify the PORT binding is working correctly
   - Check that CORS is properly configured
   - Ensure the API key is correctly set

4. **Image Processing Issues**
   - Check for memory limits (Sharp can be memory-intensive)
   - Verify input image formats are supported
   - Ensure Supabase storage permissions are set correctly

## 7. Rolling Back

If needed, you can roll back to a previous deployment:

1. In the Render Dashboard, go to your service
2. Click on **Deploys** in the left menu
3. Find a working previous deploy and click **Manual Deploy** > **Restore Deploy**

## 8. Updating Mobile App Configuration

If you've changed the endpoint URL or API key:

1. Update `app.config.js` with the new values
2. Build and deploy a new version of the mobile app

```javascript
// In app.config.js
mergeServiceUrl: process.env.MERGE_SERVICE_URL || "https://your-new-url.onrender.com/merge-clothes",
mergeApiKey: process.env.MERGE_API_KEY || 'your-new-api-key',
```
