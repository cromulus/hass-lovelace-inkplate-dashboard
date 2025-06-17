ARG BUILD_FROM
FROM ${BUILD_FROM} 

WORKDIR /app
RUN apk add --no-cache \
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
    npm

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    USE_IMAGE_MAGICK=true

COPY package*.json ./
COPY *.js ./

RUN npm ci

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

# Copy the font configuration optimized for e-ink displays
COPY fonts/fonts.conf /etc/fonts/conf.d/99-eink-fonts.conf

# Rebuild font cache
RUN fc-cache -fv

CMD [ "/run.sh" ]