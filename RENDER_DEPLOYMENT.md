# Render Deployment Guide for Fashion Calendar App Merge Service

This guide provides step-by-step instructions for deploying the image merge service to Render.

## Prerequisites

1. A Render account (https://render.com)
2. Access to the Supabase dashboard for your project
3. Your Supabase service role key and URL

## Step 1: Prepare Your Environment Variables

Before deploying, gather these required environment variables:

- `MERGE_API_KEY`: Your custom API key for authenticating requests
- `SUPABASE_URL`: Your Supabase project URL 
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `BUCKET_NAME`: The name of the storage bucket (default: "merged-images")
- `UPLOAD_PREFIX`: The prefix for uploaded files (default: "merged")
- `TARGET_WIDTH`: The width for merged images (default: 1024)

## Step 2: Create a New Web Service on Render

1. Log in to your Render dashboard at https://dashboard.render.com
2. Click "New" and select "Web Service"
3. Connect your GitHub repository or use the "Deploy from public git repository" option
   - For manual deployment, provide the repository URL
   - For a connected GitHub account, select the repository from the list
4. Configure the service:
   - **Name**: `fashion-calendar-merge-service` (or your preferred name)
   - **Region**: Choose the region closest to your users
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: `/merge-service` (if deploying from the full Fashion Calendar App repo)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run serve`
   - **Instance Type**: Free (for testing) or Basic (for production)
   - **Health Check Path**: `/health`

## Step 3: Configure Environment Variables

In the Render dashboard, add the following environment variables:

1. Click on the "Environment" tab
2. Add each environment variable:
   - `MERGE_API_KEY`: Your secret API key (e.g., "fashion-calendar-app-merge-key")
   - `SUPABASE_URL`: Your Supabase URL (e.g., "https://rlegndcywneuqqkqsuvy.supabase.co")
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `BUCKET_NAME`: "merged-images"
   - `UPLOAD_PREFIX`: "merged"
   - `TARGET_WIDTH`: "1024"

## Step 4: Deploy the Service

1. Click "Create Web Service"
2. Render will automatically build and deploy your service
3. Wait for the deployment to complete (monitor the logs for any errors)
4. Once deployed, Render will provide a URL for your service (e.g., `https://fashion-calendar-merge-service.onrender.com`)

## Step 5: Test the Deployed Service

1. Test the health endpoint:
   ```
   curl https://merge-service-csqj.onrender.com/health
   ```

2. Test the merge endpoint with your test script (update the URL):
   ```
   const serviceUrl = 'https://merge-service-csqj.onrender.com/merge-clothes';
   ```

## Step 6: Update Your App Configuration

Update your app.config.js to use the new Render service URL:

```javascript
mergeServiceUrl: process.env.MERGE_SERVICE_URL || 'https://merge-service-csqj.onrender.com/merge-clothes'
```

## Troubleshooting

1. **Service fails to build**:
   - Check the build logs for errors
   - Ensure all dependencies are correctly listed in package.json
   - Verify your Node.js version (recommended: 18.x or higher)

2. **Service starts but health check fails**:
   - Check the server logs for startup errors
   - Verify the health endpoint is correctly implemented
   - Ensure port configuration is correct (Render sets PORT automatically)

3. **Authorization errors**:
   - Check if the API key is correctly set in both the service environment and client requests
   - Verify the x-merge-api-key header is correctly sent from the client

4. **Supabase connection issues**:
   - Verify the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
   - Check if the service role key has the necessary permissions
   - Ensure the storage bucket exists and has the correct permissions

## Security Notes

- Never commit your Supabase service role key or API key to your repository
- Set up appropriate CORS policies in your service
- Consider setting up rate limiting for production use
- Regularly rotate your API keys for security
