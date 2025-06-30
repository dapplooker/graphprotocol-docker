export DISC_CAPACITY_ALERT=90
export CLEAN_DISK_SPACE=''

# Discord bot configuration
export DISCORD_BOT_TOKEN=''
export DISCORD_CHANNEL_ID=''
export DISCORD_USER_ID_TAGS=''

# Node monitoring webhook configuration
export DISCORD_WEBHOOK_URL=''

# MULTI-NODE CONFIGURATION:
# Configure multiple nodes using indexed environment variables

# Node 1 
export LOCAL_NODE_URL_1=''
export PUBLIC_NODE_URL_1=''
export NODE_NAME_1=''

# Node 2 
export LOCAL_NODE_URL_2=''
export PUBLIC_NODE_URL_2=''
export NODE_NAME_2=''

# Node 3
export LOCAL_NODE_URL_3=''
export PUBLIC_NODE_URL_3=''
export NODE_NAME_3=''

# Add more nodes by incrementing the index number (4, 5, 6, etc.)

# Default configuration
export BLOCK_THRESHOLD=100
export RETRY_DELAY=300000

# Common variables
export HOST_NAME=$(hostname)
