ARG BUILD_FROM
FROM ${BUILD_FROM}

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Bill Cromie <bill@cromie.org>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="cromulus" \
    org.opencontainers.image.authors="Bill Cromie <bill@cromie.org>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/cromulus/hass-lovelace-inkplate-dashboard" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}

WORKDIR /app

# Install system dependencies in a single layer (changes less frequently)
RUN \
    apk add --no-cache \
        chromium \
        nss \
        freetype \
        font-noto-emoji \
        freetype-dev \
        harfbuzz \
        ca-certificates \
        ttf-freefont \
        ttf-dejavu \
        ttf-liberation \
        fontconfig \
        imagemagick \
        nodejs \
        npm \
    && npm install -g npm@latest \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    USE_IMAGE_MAGICK=true

# Copy font configuration and rebuild cache
COPY fonts/fonts.conf /etc/fonts/conf.d/99-eink-fonts.conf
RUN fc-cache -fv

# Copy package files (changes less frequently than source code)
COPY package*.json ./

# Install npm dependencies in production mode
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy application files (changes most frequently - do this last)
COPY *.js ./
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]