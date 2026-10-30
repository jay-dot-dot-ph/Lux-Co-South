# Lux Co South admin chat

This implementation is local. It has not been deployed as part of the admin parity change.

## Roles

- `owner`: all conversations, staff profiles, assignments, blocking, and permanent chat deletion.
- `admin`: all conversations, assignments, and blocking.
- `staff`: only assigned conversations; can reply and change their status.

All staff need a Firebase Email/Password account and a matching `luxStaff/{AUTH_UID}` document with `role` and `active: true`. The first owner must be granted in the Firebase Console or a trusted administrator process by changing their profile's role to `owner`. The web client cannot create an owner or modify its own role. Staff management grants access to an existing Firebase Auth UID; it does not create or delete Auth accounts.

Conversation status values are `new`, `open`, `pending`, and `resolved`. New conversations have `assignedStaffUid: null`; an owner or admin can assign an active staff member. Older conversations without these fields remain visible to owners/admins and can be assigned.

Blocking writes `luxBlockedCustomers/{guestUid}`. Rules then deny that guest access to their conversation and messages. Permanent chat deletion is owner-only, removes messages before the conversation, and retains the block so the same guest UID cannot recreate the deleted chat. The confirmation dialog warns about this.

## Local verification

Start the Authentication and Firestore emulators with project `demo-lux-co-south`, then serve `dist` at `http://127.0.0.1:4173` with an emulator-only `dist/firebase-config.json`. Run `npm run test:chat-rules` and `npm run test:admin-parity`. Remove the emulator config from `dist` afterward. Tests create and delete data only in emulators.

## When deployment is authorized

Build the production site from the Sheet, then deploy the updated Firestore rules, composite index, and Hosting from this nested repository. Do not include an emulator config in the Hosting build. The current Sheet export has intermittently returned empty brand CSVs, so a full build must pass before a future deployment. Firebase indexes can take time to build before staff inbox queries work.

## Reference differences

Graceful Gifts Manila also has media uploads, push notifications, message edit/unsend, appearance accent and background controls, and an activity log. Those rely on backend and storage infrastructure outside Lux Co South's current chat, and are not part of this parity change. The Lux admin includes the requested theme, staff access, conversation management, image preview, and messaging controls.
