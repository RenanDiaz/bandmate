// Follow this setup guide: https://supabase.com/docs/guides/functions/examples/send-emails
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface EmailRequest {
  invitationId: string
}

serve(async (req) => {
  try {
    // Parse request
    const { invitationId }: EmailRequest = await req.json()

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get invitation details
    const { data: invitation, error: invError } = await supabaseClient
      .from('band_invitations')
      .select(`
        *,
        band:bands (
          id,
          name
        ),
        inviter:invited_by (
          email,
          raw_user_meta_data
        )
      `)
      .eq('id', invitationId)
      .single()

    if (invError || !invitation) {
      throw new Error('Invitation not found')
    }

    // Generate invitation link
    const invitationLink = `${Deno.env.get('APP_URL')}/invite/accept?token=${invitation.token}`

    // Prepare email content
    const inviterName = invitation.inviter?.raw_user_meta_data?.full_name ||
                       invitation.inviter?.email ||
                       'A band member'

    const roleText = invitation.role === 'member'
      ? 'a Member with full access to songs and setlists'
      : 'a Guest with limited access (expires in 30 days)'

    const expirationDate = new Date(invitation.expires_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Bandmate <noreply@yourdomain.com>', // Update with your domain
        to: [invitation.email],
        subject: `You've been invited to join ${invitation.band.name}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 8px;
                  text-align: center;
                  margin-bottom: 30px;
                }
                .header h1 {
                  margin: 0;
                  font-size: 28px;
                }
                .content {
                  background: #f9fafb;
                  padding: 30px;
                  border-radius: 8px;
                  margin-bottom: 20px;
                }
                .band-name {
                  font-size: 24px;
                  font-weight: bold;
                  color: #8b5cf6;
                  margin: 10px 0;
                }
                .role-badge {
                  display: inline-block;
                  background: #8b5cf6;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 600;
                  margin: 10px 0;
                }
                .button {
                  display: inline-block;
                  background: #8b5cf6;
                  color: white;
                  padding: 14px 32px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  margin: 20px 0;
                  transition: background 0.2s;
                }
                .button:hover {
                  background: #7c3aed;
                }
                .details {
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 20px 0;
                  border-left: 4px solid #8b5cf6;
                }
                .details-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px solid #e5e7eb;
                }
                .details-row:last-child {
                  border-bottom: none;
                }
                .details-label {
                  font-weight: 600;
                  color: #6b7280;
                }
                .footer {
                  text-align: center;
                  color: #6b7280;
                  font-size: 14px;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                }
                .link-text {
                  color: #8b5cf6;
                  word-break: break-all;
                  font-size: 12px;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>🎵 Band Invitation</h1>
              </div>

              <div class="content">
                <p>Hi there!</p>

                <p><strong>${inviterName}</strong> has invited you to join</p>
                <div class="band-name">${invitation.band.name}</div>

                <p>as <span class="role-badge">${invitation.role.toUpperCase()}</span></p>

                <div class="details">
                  <div class="details-row">
                    <span class="details-label">Role:</span>
                    <span>${roleText}</span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Invited by:</span>
                    <span>${inviterName}</span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Expires:</span>
                    <span>${expirationDate}</span>
                  </div>
                </div>

                <center>
                  <a href="${invitationLink}" class="button">
                    Accept Invitation
                  </a>
                </center>

                <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                  Or copy and paste this link into your browser:
                </p>
                <p class="link-text">${invitationLink}</p>
              </div>

              <div class="footer">
                <p>This invitation will expire on ${expirationDate}</p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                <p style="margin-top: 20px;">
                  <strong>Bandmate</strong> - Your all-in-one platform for band management
                </p>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    // Update invitation with sent timestamp
    await supabaseClient
      .from('band_invitations')
      .update({
        updated_at: new Date().toISOString(),
        // Optionally add email_sent_at field
      })
      .eq('id', invitationId)

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
