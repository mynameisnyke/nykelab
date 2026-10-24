---
title: From Lightroom to R2 in one script
description: Export, resize and upload a whole shoot without opening a browser.
date: 2026-08-03
tags: [Tools, Photo]
cover: ../../assets/journal/westminster-portrait.jpg
coverAlt: A handler's hand resting on a long-haired dog at a dog show
---

Uploading a shoot through a web form is fine for ten photos and miserable for two hundred. So I wrote a script that takes a Lightroom export folder and does the rest.

## What it does

It resizes each image to two WebP sizes, reads the caption from the file's metadata, uploads to R2 and registers everything in the database. One command, one coffee.

The admin page still exists for quick fixes, but the script is how a real shoot gets onto the site.
