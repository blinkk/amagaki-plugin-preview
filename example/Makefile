project := 
github_token :=
github_project :=
site := auto

deploy:
	gcloud builds submit \
		--project=$(project) \
		--tag gcr.io/$(project)/$(site)
	gcloud run deploy \
		--project=$(project) \
		--image gcr.io/$(project)/$(site) \
		--region us-central1 \
		--platform managed \
		--allow-unauthenticated \
		--memory 2Gi \
		--update-env-vars GITHUB_TOKEN=$(github_token) \
		--update-env-vars GITHUB_PROJECT=$(github_token) \
		$(site)