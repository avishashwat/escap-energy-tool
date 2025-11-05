FROM ghcr.io/osgeo/gdal:ubuntu-full-3.7.2

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install basic Python packages  
RUN pip3 install \
    psycopg2-binary

# Create working directory
WORKDIR /app

# Copy processing scripts
COPY main.py /app/
COPY requirements.txt /app/

# Install additional requirements
RUN pip3 install -r requirements.txt

# Expose port for API
EXPOSE 5001

# Start the GDAL processing service
CMD ["python3", "main.py"]