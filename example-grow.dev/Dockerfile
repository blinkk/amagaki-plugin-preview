FROM grow/base:py3
WORKDIR /usr/src/app
COPY package*.json ./
COPY podspec.yaml ./
COPY extensions.txt ./
RUN grow install
COPY . ./
RUN ./node_modules/.bin/gulp build
CMD [ "./preview.py", "run", "-np", "--host", "0.0.0.0", "--port", "8080" ]
