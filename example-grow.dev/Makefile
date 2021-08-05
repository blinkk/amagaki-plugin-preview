branch_token :=
github_project :=
github_token :=
project :=
site :=

deploy-preview-server:
	gcloud builds submit \
		--project=$(project) \
		--tag gcr.io/$(project)/$(site)
	gcloud run deploy \
		--project=$(project) \
		--tag $(branch_token) \
		--image gcr.io/$(project)/$(site) \
		--region us-central1 \
		--platform managed \
		--cpu 4 \
		--memory 2Gi \
		--service-account previewer-identity \
		--labels=preview-server=true,preview-branch-token=$(branch_token),preview-site=$(site) \
		--update-env-vars GITHUB_TOKEN=$(github_token) \
		--update-env-vars GITHUB_PROJECT=$(github_project) \
		$(site)
