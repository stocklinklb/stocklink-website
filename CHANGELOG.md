## 1.6.0 - 2026-10-04

- Auth: new accounts must now verify their email before they can log in
- Auth: after signing up, a verification email is sent; clicking its link verifies your email and signs you in
- Auth: you can request a new verification email if the first one doesn't arrive
- Auth: signing in with an unverified email is now blocked
- Auth: signing in with Google now counts as a verified email


## 1.5.2 - 2026-10-01

- Styling : Fixed mobile rule for the toast , as it's taking full width 


## 1.5.1 - 2026-09-30

- Styling: Changed the styling of the toast container , and changed it's position

## 1.5.0 - 2026-09-30

- Settings: you can now link your Google account to your StockLink account from the Settings page
- Settings: you can now unlink your Google account; you'll be asked to confirm with Google first
- Settings: a confirmation window now appears before you unlink your Google account
- Settings: saving your store profile now shows a clear message if something goes wrong
- Auth: now staffs can link their accounts with google , and sign in using it 

## 1.4.0 - 2026-09-30

- Auth: you can now sign in or sign up with your Google account
- Auth: if you already have a StockLink account with the same email, signing in with Google connects to it automatically

## 1.3.3 - 2026-09-29

- Dashboard: charts and the activity log now show a helpful message instead of an empty graph when there's no data yet
- Orders: the sales chart now explains whether you have no orders yet or orders that aren't sold yet

## 1.3.2 - 2026-09-29

- Auth: fixed staff login being blocked by subscription and tier middleware before the staff session was established

## 1.3.1 - 2026-09-29

- Onboarding: choosing "Import my products" now takes you to the full Excel importer instead of a simplified upload box
- Onboarding: a short guide now walks you through importing your first file
- Onboarding: choosing "Add a product" now takes you to the full add products page instead of the simplified box
- Onboarding: a short guide now walks you through adding your first product

## 1.3.0 - 2026-09-28

- Auth: users can now create their own StockLink account through signup
- Onboarding: new users are now guided through the initial StockLink setup flow after signup
- Onboarding: users can choose how they want to get started — import products, add products manually, or explore StockLink
- Onboarding: added the initial UI for inventory importing and manual product setup

## 1.2.1 - 2026-09-26

- Assistant: order proposals now show the products, quantities and prices before you approve them

## 1.2.0 - 2026-09-25

- Assistant: you can now create orders directly through the assistant
- Assistant: order creation supports adding products, customer details, and order information

## 1.1.0 - 2026-09-21

- Assistant: when you ask about one product, it now shows a card with its photo and an "Edit product" link
- Assistant: when several products match, their names are links that open each product in edit mode
- Assistant: inventory searches (low stock, out of stock, price filters) now show product links too
- Assistant: product cards and links are kept in the chat history, so they're still there after you refresh
- Assistant: product lookups send less data to the AI, which makes them lighter on usage

## 1.0.0 - 2026-09-20

- First release
