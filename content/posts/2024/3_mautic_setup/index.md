---
title: "How to Set Up Mautic 5.x on Kubernetes: A Step-by-Step Guide"
slug: mautic-5x-kubernetes-setup
date: 2024-09-04T13:00:00+01:00
author: Norbert
params:
  toc: true
tags:
- Marketing Automation
- Mautic
- Kubernetes
- DevOps
---

This guide is the fruit of my recent endeavor to set up [Mautic 5.x](https://www.mautic.org/), a marketing automation tool, in a local environment. The process shed light on the inner workings of the Doctrine queue and the role of cron jobs in background data processing. While Mautic setup guides are a dime a dozen, I found myself drawn to the installation methods using [Docker Compose](https://github.com/mautic/docker-mautic) or [Kubernetes Helm Chart](https://github.com/audacioustux/mautic-chart). This post zeroes in on the latter, primarily to scratch my itch for expanding Kubernetes expertise.

We'll cover:
- Setting up a local Kubernetes cluster with Minikube
- Installing Mautic with its accompanying ecosystem (MySQL, Mailhog) as Helm charts
- A walkthrough of cron jobs

Estimated time to complete: 60 minutes.


## What is Mautic?
Mautic is an open-source marketing automation platform that helps businesses streamline and automate their marketing activities. It stands out from proprietary alternatives by offering a fully customizable solution without licensing fees. Mautic provides features such as lead management, email marketing, campaign orchestration, and analytics, all within a self-hosted environment. This gives organizations the keys to the kingdom when it comes to their data and infrastructure, making it particularly appealing for businesses with specific privacy requirements or those looking to weave marketing automation seamlessly into their existing systems.


## Prerequisites
Before diving in, let's ensure you have all the necessary tools in your developer's toolkit. For macOS users, you can install the prerequisite software with the following command:

```bash
brew install minikube kubectl helm docker
```

To take your Kubernetes interaction up a notch, I highly recommend getting your hands on [k9s](https://k9scli.io/).


## Mautic stack design

{{< figure src="images/mautic-system-design.png" caption="Desired system design" >}}

## Kubernetes cluster setup with Minikube
Let's get the ball rolling.

```bash
minikube start --driver=docker

# let's enable some addons
minikube addons enable metrics-server
minikube addons enable ingress
```
We'll leverage the `ingress` feature to expose both Mautic UI and Mailhog.

Next, add the required Helm repositories:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add codecentric https://codecentric.github.io/helm-charts
helm repo add mautic https://mautic.github.io/helm-charts
helm repo update
```
With these steps completed, we're locked and loaded for the next phase of our setup.

### MySQL
We'll kick things off by setting up the MySQL database with a custom configuration file:

```yaml
# mysql-values.yaml
auth:
  rootPassword: myRootPassword
  database: mautic
  username: mautic
  password: mauticPassword

primary:
  persistence:
    size: 2Gi

metrics:
  enabled: true
```

Then, proceed with installing the chart.

```bash
helm install mysql bitnami/mysql -f mysql-values.yaml
```
{{< admonition info  "Accessing the database">}}
MySQL service type is set to `ClusterIP`, meaning that it is not accessible from outside of the cluster. There are multiple ways to connect to it, for example creating a `NodePort` service and instructing Minikube to forward the connection.

```yaml
# mysql-nodeport-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-nodeport
spec:
  selector:
    app.kubernetes.io/name: mysql
  type: NodePort
  ports:
    - port: 3306
      targetPort: 3306
      nodePort: 30306
```
Then install the service using `kubectl` and forward the connection:
```bash
kubectl apply -f mysql-nodeport-service.yaml
minikube service mysql-nodeport
```
Keep your eyes peeled for the port number – it's a moving target each time you run `minikube service mysql-nodeport`.

{{< /admonition >}}

### Mailhog
Mailhog installation is straightforward, but we'll configure it to use ingress routing. This setup enables browser access to the Mailhog UI for reviewing emails sent by Mautic.


Create a configuration file for Mailhog:
```yaml
# mailhog-values.yaml
ingress:
  enabled: true
  ingressClassName: nginx
  annotations:
    kubernetes.io/ingress.class: nginx
  hosts:
    - host: mailhog.local
      paths:
        - path: /
          pathType: Prefix
```

Now, install the Mailhog chart using this configuration:
```bash
helm install mailhog codecentric/mailhog -f mailhog-values.yaml
```

### Mautic
I'm leveraging the robust [mautic-chart](https://github.com/audacioustux/mautic-chart/) repository maintained by Tanjim Hossain. A few quirks need addressing before running the service properly. I'll raise these issues with the author, but at the time of writing, these steps were crucial.


#### Missing favicon ConfigMap
The Helm chart flags a missing `ct-favicon` ConfigMap definition, necessitating manual creation.

```yaml
# ct-favicon-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ct-favicon
data:
  favicon.ico: |
    PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij4KICA8cGF0aCBmaWxsPSIjNENBRjUwIiBkPSJNMTIgMTcuMjdMMTguMTggMjFsLTEuNjQtNy4wM0wyMiA5LjI0bC03LjE5LS42MUwxMiAyIDkuMTkgOC42MyAyIDkuMjRsNS40NiA0LjczTDUuODIgMjF6Ii8+Cjwvc3ZnPg==
```

```bash
kubectl apply -f ct-favicon-configmap.yaml
```

#### Adjust values files
Modify specific properties from the [original chart's values.yaml file](https://github.com/audacioustux/mautic-chart/blob/main/charts/mautic/values.yaml):

- Update `SITE_URL` to `http://mautic.local`,
- Revise `MAUTIC_ADMIN_*` related credentials,
- Configure `MAUTIC_MAILER_DSN` to `smtp://mailhog.default.svc.cluster.local:1025` for Mailhog SMTP integration,
- Modify the HTTP health-check probe to respond to 200 status code instead of 301,
- Update `db` properties, setting the host to `mysql.default.svc.cluster.local` and adjusting user credentials accordingly
- Enable `ingress` mode by setting the service host to `mautic.local`

Optional adjustments::
- Fine-tune cron job schedules (see below)
- Enable API access by setting both `MAUTIC_API_ENABLED: "1"` and `MAUTIC_API_ENABLE_BASIC_AUTH: "true"`,
- Add geo IP lookup table credentials by setting the `MAUTIC_IP_LOOKUP_AUTH` variable. 

You can reference the example of the desired `mautic-values.yaml` file [here](files/mautic-values.yml).

{{< admonition info "Persisting other configuration options">}}
By default, the `config/local.php` config file is set to be read-only, which prevents you from manually configuring the service. However, you can temporarily relax the permissions to look up the file after changes and persist them in your `mautic-values.yaml`.

Notice the variable prefix of `MAUTIC_` required for the changes to be applied to the file.

```bash
# relaxing config file permissions
chmod 664 config/local.php
chown www-data:www-data config/local.php
```
{{< /admonition >}}

#### Start service and fix permissions issue
At this point, you should be able to install the Helm chart using the specific revision.

```bash
helm install mautic mautic/mautic --version 5.1.71 -f mautic-values.yaml 
```
After a while, you'll notice that the `mautic` pod fails to start due to the healthcheck endpoint returning a 500 status code.

{{< figure src="images/mautic-permissions.png" caption="Mautic healthcheck probe returning \"Server Error\" status code" >}}

The error is caused by Kubernetes claiming invalid ownership of the var/ directory. We can resolve this manually:

```bash
chown -R www-data:www-data var
```

After this adjustment, the entire stack should be fully functional.

### Web UI access
To reach both Mailhog and Mautic apps in the browser, we'll leverage Minikube's tunneling feature.

```bash
# (own terminal)
sudo minikube tunnel
```
Additionally, add the following entries to the `/etc/hosts` file:
```
# /etc/hosts
# ...

127.0.0.1 mautic.local
127.0.0.1 mailhog.local
```
And voilà, you should be able to access both Mautic and Mailhog from the browser.

{{< figure src="images/mailhog.png" caption="Mailhog UI ([mailhog.local](http://mailhog.local))" >}}
{{< figure src="images/mautic.png" caption="Mautic Web UI ([mautic.local](http://mautic.local))" >}}

### API access
Here are a couple of examples of how you can interact with Mautic using the HTTP API. Before proceeding, ensure that you've enabled API access in the `mautic-values.yaml` file.

Each request requires authorization, meaning you need to provide your credentials using basic auth. Assuming the username is `admin` with password `Maut1cR0cks!`, the authorization header should look like this:

```bash
echo "Authorization: Basic $(echo -n "admin:Maut1cR0cks!" | base64)"
# Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh
```

```bash
# Creating a new stage
curl -X POST \
  'http://mautic.local/api/stages/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Top of Funnel",
    "description": "Stage for newly acquired customers",
    "weight": 1,
    "isPublished": true
  }'
```

```bash
# create a new user segment, pointing to the stage we just created
curl -X POST \
  'http://mautic.local/api/segments/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Top of Funnel",
    "description": "Top of Funnel Users",
    "isPublished": 1,
    "filters": [
      {
        "glue": "and",
        "object": "lead",
        "field": "stage",
        "type": "stage",
        "operator": "=",
        "properties": {"filter": 1}
      }
    ]
  }'
```

```bash
# create a new lead (contact)
curl -X POST \
  'http://mautic.local/api/contacts/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "points": 10
  }'
```

You can reference Mautic Developer docs for a full API reference [here](https://developer.mautic.org/rest-api/rest-api-overview).

## Jobs
Mautic leverages jobs to process background tasks. There are a few types of jobs, each with different purposes and interdependencies. These jobs are often set up with cron jobs at the server level but can also be triggered via CLI.

{{< admonition info  "Manual job execution">}}
To play around with jobs manually, you can disable them in `mautic-values.yaml` by setting the `enabled` property to `false` and then execute the `php bin/console <job_name>` command.
{{< /admonition >}}

### Essentials
Several essential cron jobs are required to keep the Mautic service running and updating data in the background, laying the groundwork for its core functionality. Note that most of them can be parameterized for efficiency (like the input batch size).

The following ones are dependent on each other, thus they should be staggered and scheduled in the following order:

#### `mautic:segments:update`
This job identifies new contacts to be added to a segment and orphaned contacts to be removed from segments. ([code](https://github.com/mautic/mautic/blob/5.x/app/bundles/LeadBundle/Model/ListModel.php#L314)) (alias `mautic:segments:rebuild`)

#### `mautic:campaigns:rebuild`
This job updates campaign membership by adding or removing contacts from campaigns based on the selected segments. ([code](https://github.com/mautic/mautic/blob/5.x/app/bundles/CampaignBundle/Membership/MembershipBuilder.php#L37C1-L37C126)) (alias `mautic:campaigns:update`)

#### `mautic:campaigns:trigger` 
This job triggers timed events for published campaigns. ([code](https://github.com/mautic/mautic/blob/b5d174f2d2b8582bc18101ddf09ed2559c34c604/app/bundles/CampaignBundle/Command/TriggerCampaignCommand.php))

### Queue processing
Events like sending emails and registering page hits are buffered in the `messenger_messages` table using the Doctrine framework. You need to set up certain jobs to periodically process the queue.

#### `messenger:consume email`
Consume email messages from the message queue and process them.

#### `messenger:consume hit`
Consumes page/video hits from the message queue and processes them.

#### `messenger:consume failed`
Consumes failed messages from the message queue and tries to re-processes them.

### Others

#### `mautic:broadcasts:send`
Handles the sending of scheduled emails (by setting _Publish/Unpublish_ dates).

#### `mautic:messages:send`
Attempts to process all pending (bounced) emails that haven't reached their maximum retry count.

{{< admonition info  "All available jobs">}}
When you issue the `php bin/console` command without any arguments, you will see the list of available Mautic jobs.
{{< /admonition >}}

## Next steps
- Deploy Mautic on a public cloud provider with SSL/TLS certificates.
- Configure Mautic to send emails using a real SMTP server.
- Set up database backup policies.
- Configure data migration tools to feed the Mautic with real data.