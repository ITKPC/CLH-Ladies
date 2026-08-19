# Club La Huerta Ladies Pickleball Group App

## Purpose

A simple pickleball app for the Club La Huerta Ladies Pickleball Group in San José del Cabo.

The app is designed to organize structured ladies' pickleball play without maintaining a permanent player database.

The app should support three play formats:

- Ladder
- Round Robin
- League-style play

The organizer chooses the format for each session.

## Core Principle: No Persistent Data Storage

The app does not maintain long-term player data and does not require a database or backend data store.

Information is entered only as needed for the current session, such as:

- Player names
- Skill level or rating
- Attendance
- Court assignments
- Game scores

The app uses this information to organize play and calculate results for the active session.

No permanent player profiles, attendance histories, season histories, or long-term standings are required.

Active-session information should remain on the user's device only. Temporary browser memory or `sessionStorage` may be used so an active session can survive normal navigation or an accidental page refresh. Session information should not be sent to or permanently stored on a server.

If users want to keep results, they can manually copy, download, export, or otherwise save them outside the app.

## Deployment

The application will be deployed through Netlify from the GitHub repository:

`ITKPC/CLH-Ladies`

The intended architecture is a static client-side web application:

- Netlify hosts and deploys the site.
- GitHub `main` is the deployment source.
- No application database is required.
- No authentication is required for the initial version.
- No server-side player or match data is stored.
- Active-session state is handled in the browser only.
- PWA and offline capability may be added later.

## Basic Session Flow

1. Start a new session.
2. Enter the players participating that day.
3. Optionally enter each player's skill level or rating.
4. Choose a play format:
   - Ladder
   - Round Robin
   - League
5. Generate groups, courts, partners, and opponents.
6. Play the games.
7. Enter scores or results.
8. Automatically calculate rankings, court movement, or standings.
9. Generate the next round if required.
10. End the session.

## Play Formats

### Ladder

Players are grouped onto courts based on their starting order or skill level.

After each round, results determine movement.

Possible rules include:

- Winners move up.
- Lower finishers move down.
- Players rotate between courts.
- The app creates the next court assignments automatically.

The exact ladder rules should be configurable.

### Round Robin

Players rotate through partners and opponents so they play with different people during the session.

The app should:

- Generate balanced groups.
- Create rotations.
- Minimize repeated partners where possible.
- Minimize repeated opponents where possible.
- Handle different numbers of available players.
- Track scores during the session.
- Calculate session standings if desired.

### League

League mode provides more structured competition during a session or manually managed series of sessions.

The app can:

- Create matchups.
- Record scores.
- Calculate wins and losses.
- Calculate points or rankings.
- Display standings for the current active league session.

Because the app does not retain data, any multi-session league information would need to be re-entered, imported, or externally maintained.

## Main Screens

### Home

Primary actions:

- Start New Session
- Current Session
- How It Works

### New Session

Organizer enters:

- Session name
- Date, if desired
- Number of courts
- Player names
- Optional player ratings
- Play format

### Courts

Displays:

- Court number
- Players
- Partners
- Opponents
- Current round

### Score Entry

Allows quick entry of:

- Game score
- Winner
- Optional point differential

### Results

Displays results appropriate to the selected format:

- Ladder movement
- Round-robin rankings
- League standings
- Next-round assignments

## Design Goals

The app should be:

- Extremely easy to use
- Mobile-first
- Fast enough to use courtside
- Suitable for players who are not highly technical
- Clear in bright outdoor conditions
- Minimal in the number of screens and taps
- Flexible enough for different group sizes
- Independent of permanent accounts or profiles

## Privacy Approach

The app is designed around temporary session information rather than a permanent member database.

The intended principle is:

> Enter what is needed to organize today's play, use it for the session, and do not store it permanently on a server.

Temporary client-side state should be cleared when the session is deliberately ended. The implementation should make the lifecycle of browser-held session information explicit.

## Possible Future Features

These can be considered later without being required for the first version:

- Printable court sheets
- Export results
- Share session results
- QR code for joining a session
- Automatic court balancing
- DUPR rating entry
- Custom scoring formats
- Team play
- Playoffs
- Tournament mode
- Offline mode

## Recommended MVP

The first version should focus on one excellent session workflow:

1. Enter players.
2. Select Ladder, Round Robin, or League.
3. Generate courts.
4. Enter scores.
5. Calculate results.
6. Generate the next round.

Everything else can be added after the Club La Huerta Ladies Pickleball Group has used the app and identified what they actually need.
