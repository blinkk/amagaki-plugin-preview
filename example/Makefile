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
		--memory 2Gi \
		--service-account previewer-identity \
		--labels=preview_server=true,preview_branch=$(branch),preview_site=$(site) \
		--update-env-vars GITHUB_TOKEN=$(github_token) \
		--update-env-vars GITHUB_PROJECT=$(github_project) \
		$(site)
