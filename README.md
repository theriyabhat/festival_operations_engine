# Festival Operations Engine (Team Short Circuits)

A configuration-driven decision layer between citizen/volunteer reports and BMC operations.
Primary demo: Ganesh Visarjan, Lalbaug-Girgaon, Mumbai.

## Run
    npm install
    npm start        # http://localhost:3000
    npm test

## Core rule
The engine reads only a festival profile JSON (`/config/profiles`).
Adding a festival = adding one file (or pasting JSON at runtime).

Status: Step 1 of 11 (server skeleton + profile loader).
