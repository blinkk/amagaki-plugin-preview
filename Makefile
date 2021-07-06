project :=

deploy:
	gcloud app deploy \
	  --project=$(project) \
	  --version=auto \
	  --verbosity=error \
	  -q \
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
