#!/bin/bash

# Variables - Customize these as needed
USER="dghadmin"
HOST="161.200.105.34"
TARGET_PATH="/var/www/bridge"
BUILD_DIR="dist"

# Run Vite build
echo "Building the Vite project..."
npm run build

# Check if the build was successful
if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

# Deploy to remote server
echo "Deploying to $USER@$HOST:$TARGET_PATH..."
scp -r $BUILD_DIR/* $USER@$HOST:$TARGET_PATH

# Check if the deployment was successful
if [ $? -eq 0 ]; then
    echo "Deployment successful!"
else
    echo "Deployment failed."
fi