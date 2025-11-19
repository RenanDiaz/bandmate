# Setting Up Email Sending for Band Invitations

This guide shows how to set up automatic email sending for band invitations using Supabase Edge Functions and Resend.

## Why This Approach?

- ✅ **First-party Supabase integration** - Official Supabase + Resend partnership
- ✅ **Free tier** - 3,000 emails/month on Resend free tier
- ✅ **No credit card required** - Start free
- ✅ **Modern API** - Clean, simple email API
- ✅ **Official templates** - Supabase provides ready-made templates

## Prerequisites

1. Supabase account
2. Resend account (free tier: 3,000 emails/month)
3. Supabase CLI installed

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

## Step 2: Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up (free, no credit card)
3. Verify your email
4. Go to API Keys → Create API Key
5. Copy the API key (starts with `re_`)

## Step 3: Configure Domain (Optional but Recommended)

**For Production**:
1. In Resend dashboard → Domains
2. Add your domain
3. Add DNS records provided by Resend
4. Verify domain

**For Development**:
- Use Resend's test email: `onboarding@resend.dev`
- Emails will work but may go to spam

## Step 4: Deploy Edge Function

### Initialize Supabase (if not done)

```bash
cd /path/to/bandmate
supabase init
```

### Set Environment Variables

In Supabase Dashboard → Edge Functions → Secrets:

```bash
# Via CLI:
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set APP_URL=https://yourdomain.com

# Or via Dashboard:
# Settings → Edge Functions → Add new secret
```

Environment variables needed:
- `RESEND_API_KEY` - Your Resend API key
- `APP_URL` - Your app URL (e.g., https://bandmate.vercel.app)
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

### Deploy the Function

```bash
# Deploy the function
supabase functions deploy send-invitation-email

# Test it works
supabase functions list
```

## Step 5: Update Frontend to Call Function

The function is already integrated! When you create an invitation, it will automatically call the edge function.

Check `src/services/bandMembersService.ts` - the `createBandInvitation` function now calls the edge function.

## Step 6: Test the Flow

1. **Send an invitation**:
   - Go to Band Settings → Members → Invite Member
   - Enter an email and role
   - Click "Send Invitation"

2. **Check the invitation was sent**:
   - Should see "Invitation sent successfully!"
   - Check recipient's inbox
   - Check spam folder if not in inbox

3. **Accept the invitation**:
   - Click link in email
   - Should see acceptance page
   - Click "Accept Invitation"

## Troubleshooting

### Issue: Function not found
```bash
# Redeploy
supabase functions deploy send-invitation-email
```

### Issue: Emails not sending
1. Check Edge Function logs in Supabase Dashboard
2. Verify RESEND_API_KEY is set correctly
3. Check Resend dashboard for delivery status
4. Verify "from" email domain is verified in Resend

### Issue: Emails go to spam
- Verify your domain in Resend
- Add SPF, DKIM, DMARC records
- Use a real domain (not test addresses)

### Issue: Rate limits
- Free tier: 3,000 emails/month
- Upgrade to paid plan if needed ($20/month for 10,000 emails)

## Cost Breakdown

### Resend Pricing
- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro**: $20/month for 10,000 emails
- **Enterprise**: Custom pricing

### Supabase Edge Functions
- **Free Tier**: 500,000 invocations/month
- **Pro**: $25/month for 2M invocations

For a small to medium band (< 100 invitations/month), this is **completely free**!

## Alternative: Database Trigger (Advanced)

Instead of calling from frontend, you can use a database trigger:

```sql
-- Create trigger to call edge function when invitation is created
CREATE OR REPLACE FUNCTION send_invitation_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-invitation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('invitationId', NEW.id::text)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invitation_created
  AFTER INSERT ON band_invitations
  FOR EACH ROW
  EXECUTE FUNCTION send_invitation_email_trigger();
```

This way, emails are sent automatically without frontend code!

## Email Template Customization

Edit `supabase/functions/send-invitation-email/index.ts` to customize:
- Email design (HTML)
- Subject line
- From name
- Button text
- Colors and branding

## Next Steps

1. Deploy edge function
2. Set environment variables
3. Test with your email
4. Verify domain for production
5. Customize email template
6. Monitor delivery rates

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Resend Documentation](https://resend.com/docs)
- [Send Emails with Supabase Guide](https://supabase.com/docs/guides/functions/examples/send-emails)
