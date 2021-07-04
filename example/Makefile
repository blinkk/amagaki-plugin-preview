branch := main
github_project :=
github_token :=
project :=
site := auto

deploy-preview-server:
	gcloud builds submit \
		--project=$(project) \
		--tag gcr.io/$(project)/$(site)
	gcloud run deploy \
		--project=$(project) \
		--no-traffic \
		--tag $(branch) \
		--image gcr.io/$(project)/$(site) \
		--region us-central1 \
		--platform managed \
		--allow-unauthenticated \
		--memory 2Gi \
		--update-env-vars GIT_BRANCH=$(branch) \
		--update-env-vars GITHUB_TOKEN=$(github_token) \
		--update-env-vars GITHUB_PROJECT=$(github_project) \
		$(site)
