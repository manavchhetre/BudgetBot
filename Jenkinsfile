pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    triggers {
        pollSCM('H/1 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                sh '''
                    docker run --rm \\
                      -v "$WORKSPACE:/workspace" \\
                      -w /workspace \\
                      python:3.12-slim \\
                      sh -c 'pip install --disable-pip-version-check -r requirements.txt && pytest --tb=short -q'
                '''
            }
        }
    }

    post {
        always {
            echo "Build ${env.BUILD_NUMBER} finished with ${currentBuild.currentResult}; triggered by ${currentBuild.getBuildCauses().collect { it.userId ?: it.shortDescription }.join(', ')}"
        }
    }
}
