# SNES Tizen Emulator installation guide

This guide shows, step by step, how to install the SNES Tizen Emulator on your
own Samsung Smart TV (Tizen). The process is the same one developers use to test
applications on the TV (sideloading with Developer Mode enabled).

Portuguese version: see [INSTALACAO.md](INSTALACAO.md).

Read the certificate section first. It explains why there is no one click
installer and why each person has to do a few steps the first time.

## Before you start: the certificate constraint

Samsung requires every application installed on the TV to be signed with a valid
certificate. The distributor certificate is tied to the DUID (unique identifier)
of the target TV. In practice this means:

- There is no ready made `.wgt` that installs on any TV. A package signed with
  one TV's DUID will not install on another.
- Each person must generate their own certificate, with their own Samsung
  account and their own TV's DUID, and sign the package.
- The Samsung account plus per device certificate step cannot be automated. That
  is why installation is done through this step by step guide and not through an
  automatic installer.

Source: Samsung Developers, "Creating Certificates".

## Prerequisites

- A Samsung Smart TV running Tizen (the project was validated on a Samsung
  65BU8000, Tizen 6.5).
- A Windows PC on the same network as the TV (wired or Wi-Fi).
- A free account on the Samsung Developers Portal
  (https://developer.samsung.com).
- Tizen Studio installed, with the "Samsung Certificate Extension" package.
- This repository's files downloaded on the PC.

Estimated time the first time: 30 to 60 minutes. Most of it (installing Tizen
Studio and creating the certificate) is done only once. Later installs are
quick.

## Step 1: Install Tizen Studio and the certificate extension

1. Download and install Tizen Studio (the version with the IDE) from the Samsung
   site.
2. Open the Tizen Studio Package Manager.
3. On the "Extension SDK" tab, install the "Samsung Certificate Extension".

> Image 01: Package Manager with the Samsung Certificate Extension installed.

## Step 2: Enable Developer Mode on the TV

1. On the TV, open Smart Hub and go to the Apps panel.
2. Open "App Settings".
3. Type 12345 with the remote or the on screen keypad. The Developer Mode popup
   appears.
4. Turn "Developer mode" On.
5. Enter the IP address of the PC that will connect to the TV and confirm with
   "OK".
6. Reboot the TV. After it restarts, "Develop Mode" appears at the top of the
   Apps panel.

To find the PC IP on Windows: open Command Prompt, run `ipconfig`, and use the
"IPv4 Address" of your network.

> Image 02: Developer Mode popup on the TV with the PC IP filled in.

## Step 3: Find the TV IP and connect

1. On the TV: Settings > General (or Connection) > Network > Network Status > IP
   Settings. Note the TV's IP address.
2. On the PC, open Tizen Studio and go to "Tools > Device Manager".
3. Click "Remote Device Manager", then the "+" button.
4. In "Add Device", enter a name, the TV's IP address and port 26101, then click
   "Add".
5. Select the TV in the list and switch "Connection" to "On". The TV should show
   as connected.

> Image 03: Device Manager with the TV connected.

## Step 4: Get the TV DUID

The DUID is the TV's unique identifier, required to create the certificate.
There are two ways to get it:

- On the TV: Menu > Support > Contact Samsung > "Unique Device ID".
- In Tizen Studio: with the TV connected (Step 3), the DUID can also be pulled
  directly from the connected device while creating the certificate (Step 5).

> Image 04: DUID shown (on the TV or in the Tizen Studio wizard).

## Step 5: Create the Samsung certificate

1. In Tizen Studio, open "Tools > Certificate Manager".
2. If the "Migration for Certificate Profile" dialog appears, click "Cancel".
3. Click "+" to open the profile creation wizard.
4. Click "Samsung".
5. Select "TV" and click "Next".
6. Give the profile a name and click "Next". Keep this name: it is used to sign
   the package.
7. Author certificate:
   - Choose "Create a new author certificate" and click "Next".
   - Fill in the details and click "Next".
   - Sign in with your Samsung Developer account.
   - Set a backup path for the certificate file and click "Next".
8. Distributor certificate:
   - Choose "Create a new distributor certificate" and click "Next".
   - Set the privilege level you need.
   - Enter the TV's DUID manually, or click the "+" next to the connected device
     in the list.
9. Click "Finish".

Important: keep the author certificate in a safe place. App updates must be
signed with the same author certificate, otherwise the TV may treat the new
version as a different application.

> Image 05: Certificate Manager wizard at the DUID step.

## Step 6: Import the project into Tizen Studio

1. In Tizen Studio, use "File > Import > Tizen > Tizen Project".
2. Point it to this repository's folder (the root, where `config.xml` and
   `index.html` are).
3. Confirm that the active certificate profile is the one you created. In
   Certificate Manager, the active profile is marked.

> Image 06: project imported with the active certificate profile.

## Step 7: Package, sign, install and launch

With the TV connected (Step 3) and the certificate profile active (Step 5):

1. Right click the imported project.
2. Choose "Run As > Tizen Web Application".
3. Tizen Studio packages, signs, installs and opens the app on the TV in a
   single action.

That is it. The SNES Tizen Emulator icon now appears on the TV, and the app can
be opened from the lilauncher.

> Image 07: SNES Tizen Emulator running on the TV.

## Command line alternative

If you are comfortable with a terminal, you can do the same steps through the
Tizen CLI instead of the GUI. The flow is: connect with `sdb`, build the package
with `tizen build-web`, sign it with `tizen package -s <your-profile>` and
install it with `tizen install`. See the Tizen Studio CLI reference for the
exact command syntax. Signing uses the same certificate profile created in
Step 5.

## Troubleshooting

- The TV does not connect in Device Manager: confirm the PC and TV are on the
  same network, that Developer Mode is on with the correct PC IP, and that the
  TV was rebooted. The port is 26101.
- Signing error while packaging: confirm the certificate profile is active in
  Certificate Manager and that the DUID you entered is the target TV's.
- Installs on one TV but not on another: expected behavior. The certificate is
  tied to the DUID. Create a new certificate with the other TV's DUID.

## Summary

- The distributor certificate is tied to the TV's DUID, so each TV needs its own
  certificate.
- It is not possible to distribute a ready made `.wgt` that installs on any TV
  through this path (sideloading).
- Publishing through the Samsung store, which would remove the per device
  certificate, is under future evaluation.

## References

- Samsung Developers, Creating Certificates:
  https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html
- Samsung Developers, TV device (Developer Mode):
  https://developer.samsung.com/tv/develop/getting-started/using-sdk/tv-device
