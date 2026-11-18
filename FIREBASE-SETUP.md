# TBARC Academy – Firebase connection

## Included
- Firebase web configuration for project `tbarc-academy`
- Google sign-in using Firebase Authentication
- Dashboard authentication guard
- Initial enrollment lookup in Firestore

## Before testing
1. Firebase Console → Authentication → Sign-in method: make sure Google is enabled.
2. Authentication → Settings → Authorized domains: add `unaisbot.github.io` (and later `academy.tbarc.in` after DNS is working).
3. Deploy these files to the root of the GitHub Pages repository.

## Important: create the first administrator
1. Open the deployed site and sign in once with the Google account that should administer TBARC Academy.
2. Firebase Console → Authentication → Users. Find that account and copy its UID.
3. Firestore Database → Data → Start collection `admins`.
4. Use the UID as the document ID. Add fields such as:
   - `email` (string): your exact Google email
   - `role` (string): `admin`
5. The user will then be recognized as an administrator by the dashboard and the Firestore rules.

Do not let participants create or edit documents in `admins`.

## Enrollment document shape
For a participant, create a document in `enrollments` with a unique document ID and fields:
- `uid` (string): Firebase Authentication UID of the participant
- `courseId` (string): matching document ID in `courses`
- `status` (string): `approved`
- `accessExpiry` (timestamp): Firestore Timestamp, exactly three calendar months after approval

Create a matching `courses/{courseId}` document with at least:
- `title` (string)
- `published` (boolean)

The dashboard currently displays active enrollment/course titles. Video playback and automated Google Drive permission granting/revocation will be implemented in a later stage.

## Security notes
- Firebase web config is not a server secret. Firestore Security Rules are the security boundary.
- Never put service-account keys or private credentials in this public repository.
- Review and test Firestore rules before real participant data is added.
