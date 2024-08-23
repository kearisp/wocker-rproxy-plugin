FROM python:3.9-slim

ENV CONTAINER=default
ENV PORT=80

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libffi-dev \
    libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Встановлюємо PageKite через pip
#RUN pip install --upgrade pip && \
#    pip install pagekite

# Вказуємо робочу директорію
WORKDIR /app

RUN pwd && \
    curl -O https://pagekite.net/pk/pagekite.py && \
    ls -la && \
    chmod +x pagekite.py



#EXPOSE 80 443 22

# Вказуємо команду для запуску PageKite
#CMD ["/app/pagekite.py", "$CONTAINER:$PORT"]

CMD ["bash"]