FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    bash wget unzip

WORKDIR /app

RUN wget -q https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-linux-64.zip

RUN unzip Xray-linux-64.zip && rm Xray-linux-64.zip

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["bash", "/app/entrypoint.sh"]