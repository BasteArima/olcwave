FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    bash wget unzip

WORKDIR /app

RUN wget -q https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-linux-64.zip

RUN unzip Xray-linux-64.zip && mv Xray-linux-64 xray && rm Xray-linux-64.zip

CP entrypoint.sh .

ENTRYPOINT ["/app/entrypoint.sh"]