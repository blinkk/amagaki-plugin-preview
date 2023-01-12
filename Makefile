project :=

deploy:
	npm run dev:start
	gcloud app deploy \
	  --project=$(project) \
	  --verbosity=error \
	  -q \
	  --no-promote \
	  app.yaml

deploy-run:
	gcloud builds submit \
		--tag gcr.io/$(project)/preview-proxy
	gcloud run deploy \
		--image gcr.io/$(project)/preview-proxy \
		--allow-unauthenticated \
		--region us-central1 \
		--service-account preview-proxy-identity \
		--update-env-vars GOOGLE_CLOUD_PROJECT=$(project) \
		--platform managed \
		preview-proxy
