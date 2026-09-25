# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth authentication for Bandmate.

## Prerequisites

- A Supabase project
- A Google Cloud Platform account

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in the required app information:
     - App name: `Bandmate`
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes (optional for basic auth):
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Add test users if still in development
   - Submit for verification (required for production)

6. Back in **Credentials**, click **Create Credentials** > **OAuth client ID** again
7. Choose **Web application**
8. Configure the OAuth client:
   - **Name**: `Bandmate Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (for local development)
     - Your production domain (e.g., `https://bandmate.yourdomain.com`)
   - **Authorized redirect URIs**:
     - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
     - Note: Replace `YOUR_SUPABASE_PROJECT_ID` with your actual Supabase project reference ID

9. Click **Create**
10. Copy the **Client ID** and **Client Secret** - you'll need these for Supabase

## Step 2: Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click to expand
5. Enable the Google provider by toggling the switch
6. Paste your Google OAuth credentials:
   - **Client ID**: Paste the Client ID from Google Cloud Console
   - **Client Secret**: Paste the Client Secret from Google Cloud Console
7. Click **Save**

## Step 3: Update Your Environment (Optional)

If you want to customize the redirect URL or other OAuth settings, you can update your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 4: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173`

3. Click the **Sign in with Google** button

4. You should be redirected to Google's login page

5. After successful authentication, you'll be redirected back to your app

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

This error means the redirect URI doesn't match what you configured in Google Cloud Console.

**Solution**:
1. Check that your Supabase callback URL is correct: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
2. Make sure this exact URL is listed in **Authorized redirect URIs** in Google Cloud Console
3. Wait a few minutes for changes to propagate

### "This app isn't verified"

During development, Google will show a warning screen.

**Solution**:
- Click **Advanced** > **Go to Bandmate (unsafe)** to proceed
- For production, you must submit your app for verification in the Google Cloud Console

### "Access blocked: This app's request is invalid"

This usually means the OAuth consent screen isn't properly configured.

**Solution**:
1. Go to **APIs & Services** > **OAuth consent screen**
2. Complete all required fields
3. Add your email as a test user
4. Ensure all required scopes are added

### Users can't sign in

**Solution**:
1. Check that the Google provider is enabled in Supabase
2. Verify your Client ID and Secret are correct
3. Check browser console for errors
4. Ensure your app URL is in the authorized origins list

## Security Best Practices

1. **Never commit credentials**: Keep your Client Secret secure and never commit it to version control
2. **Use environment variables**: Store sensitive data in `.env` files (which are gitignored)
3. **Restrict origins**: Only add authorized JavaScript origins for domains you own
4. **HTTPS in production**: Always use HTTPS for production deployments
5. **Verify users**: Implement proper user verification and email confirmation flows
6. **Rate limiting**: Consider implementing rate limiting on authentication endpoints

## Multiple OAuth Providers

Bandmate supports both GitHub and Google OAuth. Users can sign in with either provider, and Supabase will:
- Create a new user if they sign in for the first time
- Link to an existing user if they use the same email address across providers

## Next Steps

- Configure Row Level Security (RLS) policies for your database tables
- Implement email confirmation if required
- Set up user profile management
- Add additional OAuth providers (Facebook, Twitter, etc.) if needed

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google Auth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
