// Email Service using Gmail (Free!)
// 
// SETUP INSTRUCTIONS:
// 1. Go to your Google Account settings: https://myaccount.google.com
// 2. Go to Security → 2-Step Verification (enable if not already)
// 3. Go to Security → App Passwords
// 4. Create a new App Password for "Mail" on "Other (Custom name)" → call it "Golf App"
// 5. Copy the 16-character password Google gives you
// 6. Add to your .env file:
//    EMAIL_USER=youremail@gmail.com
//    EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx (the 16-char password, spaces optional)
//    FRONTEND_URL=http://localhost:3006 (or your production URL)

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3006';

// Create Gmail transporter
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('⚠️  Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD.replace(/\s/g, '') // Remove spaces from app password
    }
  });
};

// Generate check-in URL for a player
export const generateCheckInUrl = (inviteToken) => {
  return `${BASE_URL}/checkin/${inviteToken}`;
};

// Email templates
const getInviteEmailHtml = (playerName, tournamentName, tournamentDate, gameCode, checkInUrl) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited!</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f5f7fa;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #00205B; margin: 0;">The Open Invitational</h2>
          <div style="height: 4px; background: linear-gradient(90deg, #00205B 0%, #D4A574 50%, #CE1126 100%); border-radius: 2px; margin: 16px auto; width: 100px;"></div>
        </div>
        
        <!-- Main Content -->
        <h1 style="font-size: 28px; color: #1a1a1a; margin: 0 0 8px 0; text-align: center;">Hey ${playerName}! 👋</h1>
        <p style="font-size: 18px; color: #666; margin: 0 0 32px 0; text-align: center;">You've been invited to play!</p>
        
        <!-- Tournament Details -->
        <div style="background: #f5f7fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; vertical-align: top; width: 40px;">🏆</td>
              <td style="padding: 8px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase;">Tournament</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a1a1a;">${tournamentName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; vertical-align: top;">📅</td>
              <td style="padding: 8px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase;">Date</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a1a1a;">${tournamentDate}</div>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Game Code -->
        <div style="text-align: center; margin: 32px 0; padding: 24px; background: linear-gradient(135deg, #D4A574 0%, #B8932E 100%); border-radius: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Game Code</div>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #1a1a1a;">${gameCode}</div>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${checkInUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #00205B 0%, #003080 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">
            ✓ I'm In - Check Me In!
          </a>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 14px; margin: 24px 0 0 0;">
          Or visit <strong>${BASE_URL}/tournament/${gameCode}</strong>
        </p>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px; margin: 0;">See you on the first tee! ⛳</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

const getReminderEmailHtml = (playerName, tournamentName, tournamentDate, gameCode, checkInUrl, hoursUntil) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f5f7fa;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #00205B; margin: 0;">The Open Invitational</h2>
        </div>
        
        <!-- Alert Box -->
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px;">⏰</div>
          <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 8px 0;">Hey ${playerName}!</h1>
          <p style="font-size: 16px; color: #666; margin: 0;">
            <strong>${tournamentName}</strong> starts in <strong>${hoursUntil} hours</strong>!
          </p>
        </div>
        
        <p style="text-align: center; color: #666; margin-bottom: 24px;">You haven't checked in yet. Tap below to confirm you're playing:</p>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 24px 0;">
          <a href="${checkInUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #CE1126 0%, #A00F24 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">
            Check In Now →
          </a>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 14px;">
          📅 ${tournamentDate}<br>
          🎯 Code: <strong>${gameCode}</strong>
        </p>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px; margin: 0;">Don't miss out! ⛳</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

// Send player invite email
export const sendPlayerInvite = async (player, game) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log(`📧 [DEV MODE] Would send invite to ${player.email}`);
    console.log(`   Check-in URL: ${generateCheckInUrl(player.invite_token)}`);
    return { success: true, devMode: true };
  }

  const checkInUrl = generateCheckInUrl(player.invite_token);
  const tournamentDate = new Date(game.tournament_date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  try {
    await transporter.sendMail({
      from: `"The Open Invitational" <${process.env.EMAIL_USER}>`,
      to: player.email,
      subject: `🏌️ You're invited to ${game.name}!`,
      html: getInviteEmailHtml(
        player.name,
        game.name,
        tournamentDate,
        game.game_code,
        checkInUrl
      ),
      text: `
Hey ${player.name}!

You've been invited to ${game.name}!

📅 Date: ${tournamentDate}
🎯 Game Code: ${game.game_code}

Check in here: ${checkInUrl}

Or visit ${BASE_URL}/tournament/${game.game_code}

See you on the first tee! ⛳
      `
    });

    console.log(`✅ Invite sent to ${player.email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send invite to ${player.email}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Send reminder email to players who haven't checked in
export const sendReminderEmail = async (player, game, hoursUntil) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log(`📧 [DEV MODE] Would send reminder to ${player.email}`);
    return { success: true, devMode: true };
  }

  const checkInUrl = generateCheckInUrl(player.invite_token);
  const tournamentDate = new Date(game.tournament_date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  try {
    await transporter.sendMail({
      from: `"The Open Invitational" <${process.env.EMAIL_USER}>`,
      to: player.email,
      subject: `⏰ Reminder: ${game.name} is in ${hoursUntil} hours!`,
      html: getReminderEmailHtml(
        player.name,
        game.name,
        tournamentDate,
        game.game_code,
        checkInUrl,
        hoursUntil
      ),
      text: `
Hey ${player.name}!

⏰ REMINDER: ${game.name} starts in ${hoursUntil} hours!

You haven't checked in yet.

📅 Date: ${tournamentDate}
🎯 Game Code: ${game.game_code}

Check in now: ${checkInUrl}

Don't miss out! ⛳
      `
    });

    console.log(`✅ Reminder sent to ${player.email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${player.email}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Send invite to all players in a game
export const sendAllInvites = async (gameId, pool) => {
  try {
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return { success: false, error: 'Game not found' };
    }
    const game = gameResult.rows[0];

    const playersResult = await pool.query(
      'SELECT * FROM game_players WHERE game_id = $1 AND invite_sent_at IS NULL',
      [gameId]
    );

    const results = [];
    for (const player of playersResult.rows) {
      const result = await sendPlayerInvite(player, game);
      results.push({ player: player.name, ...result });
      
      // Mark as sent
      if (result.success) {
        await pool.query(
          'UPDATE game_players SET invite_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
          [player.id]
        );
      }
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  generateCheckInUrl,
  sendPlayerInvite,
  sendReminderEmail,
  sendAllInvites
};