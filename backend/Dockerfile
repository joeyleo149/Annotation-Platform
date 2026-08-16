# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Api/Api.csproj", "Api/"]
COPY ["Context/Context.csproj", "Context/"]
COPY ["Service/Service.csproj", "Service/"]
RUN dotnet restore "Api/Api.csproj"

COPY . .
WORKDIR "/src/Api"
RUN dotnet publish "Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/app/venv/bin:$PATH"
COPY --from=build /app/publish .
COPY --from=build /src/Scripts ./Scripts

ENV ASPNETCORE_URLS=http://+:5138
EXPOSE 5138

ENTRYPOINT ["dotnet", "Api.dll"]